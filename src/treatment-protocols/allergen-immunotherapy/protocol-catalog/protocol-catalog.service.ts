import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProtocolVersion } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import {
  validateProtocolDefinition,
  ProtocolValidationError,
} from '../clinical-rules/protocol-definition.validator';
import { recommendNextDose } from '../clinical-rules/recommend-next-dose';
import type {
  AdministeredDoseValues,
  ResolvedPrescription,
} from '../clinical-rules/protocol-definition';
import {
  CreateProtocolDto,
  EditProtocolVersionDto,
  SimulateProtocolDto,
  AutomationSettingsDto,
} from './protocol-catalog.dto';

export function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
export function requireClinicalAuthor(user: AuthenticatedUserPayload) {
  if (
    !user.organizationId ||
    !user.professionalId ||
    !user.roles.includes('PHYSICIAN')
  )
    throw new ForbiddenException('CLINICAL_AUTHOR_REQUIRED');
}
export function persistenceDefinition(
  version: Pick<ProtocolVersion, 'definition' | 'protocolId' | 'id' | 'number'>,
) {
  try {
    if (
      (version.definition as Record<string, unknown>)
        .requiresClinicalTransitionReview === true
    )
      throw new BadRequestException('CLINICAL_TRANSITION_REVIEW_REQUIRED');
    const result = validateProtocolDefinition({
      ...(version.definition as object),
      protocolId: version.protocolId,
      versionId: version.id,
      version: version.number,
      status: 'PUBLISHED',
    });
    for (const step of result.steps) {
      if (
        !/^\d+$/.test(step.concentration) ||
        BigInt(step.concentration) > 2147483647n
      )
        throw new BadRequestException('CONCENTRATION_OUTSIDE_STORAGE_RANGE');
      const [whole, fraction = ''] = step.volume.split('.');
      if (
        whole.length > 35 ||
        fraction.length > 30 ||
        step.intervalDays > 2147483647
      )
        throw new BadRequestException('VALUE_OUTSIDE_EXACT_STORAGE_RANGE');
    }
    return result;
  } catch (error) {
    if (error instanceof ProtocolValidationError)
      throw new BadRequestException({
        code: 'INVALID_PROTOCOL',
        detail: error.message,
      });
    throw error;
  }
}

@Injectable()
export class ProtocolCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: IAuditLogService,
  ) {}

  private readAccess(user: AuthenticatedUserPayload) {
    if (
      !user.organizationId ||
      !user.roles.some((role) =>
        ['PHYSICIAN', 'NURSE', 'ADMINISTRATOR'].includes(role),
      )
    )
      throw new ForbiddenException();
  }
  list(user: AuthenticatedUserPayload) {
    this.readAccess(user);
    return this.prisma.treatmentProtocol.findMany({
      where: { organizationId: user.organizationId },
      include: { versions: { orderBy: { number: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  async read(id: string, user: AuthenticatedUserPayload) {
    this.readAccess(user);
    const version = await this.prisma.protocolVersion.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!version) throw new NotFoundException();
    return version;
  }
  async create(dto: CreateProtocolDto, user: AuthenticatedUserPayload) {
    requireClinicalAuthor(user);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${user.organizationId} FOR NO KEY UPDATE`;
      const protocol = await tx.treatmentProtocol.create({
        data: {
          name: dto.name,
          route: 'SUBCUTANEOUS',
          organizationId: user.organizationId,
          createdById: user.id,
        },
      });
      const version = await tx.protocolVersion.create({
        data: {
          protocolId: protocol.id,
          organizationId: user.organizationId,
          number: 1,
          definition: json(dto.definition),
          createdById: user.id,
        },
      });
      await this.record(tx, user, version.id, 'PROTOCOL_DRAFT_CREATED', {
        newValues: {
          definition: version.definition,
          status: version.status,
          number: version.number,
        },
      });
      return { protocol, version };
    });
  }
  async createVersion(
    protocolId: string,
    definition: Record<string, unknown>,
    user: AuthenticatedUserPayload,
  ) {
    requireClinicalAuthor(user);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${user.organizationId} FOR NO KEY UPDATE`;
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "TreatmentProtocol" WHERE id = ${protocolId} AND "organizationId" = ${user.organizationId} FOR UPDATE`;
      if (!rows.length) throw new NotFoundException();
      const last = await tx.protocolVersion.aggregate({
        where: { protocolId },
        _max: { number: true },
      });
      const version = await tx.protocolVersion.create({
        data: {
          protocolId,
          organizationId: user.organizationId,
          number: (last._max.number ?? 0) + 1,
          definition: json(definition),
          createdById: user.id,
        },
      });
      await this.record(tx, user, version.id, 'PROTOCOL_DRAFT_CREATED', {
        newValues: {
          definition: version.definition,
          status: version.status,
          number: version.number,
        },
      });
      return version;
    });
  }
  async mutate(
    id: string,
    revision: number,
    user: AuthenticatedUserPayload,
    operation: 'edit' | 'publish' | 'retire' | 'default',
    definition?: EditProtocolVersionDto['definition'],
  ) {
    requireClinicalAuthor(user);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${user.organizationId} FOR NO KEY UPDATE`;
      const initial = await tx.protocolVersion.findFirst({
        where: { id, organizationId: user.organizationId },
      });
      if (!initial) throw new NotFoundException();
      await tx.$queryRaw`SELECT id FROM "TreatmentProtocol" WHERE id = ${initial.protocolId} FOR UPDATE`;
      const version = await tx.protocolVersion.findUniqueOrThrow({
        where: { id },
      });
      if (version.revision !== revision)
        throw new ConflictException('STALE_PROTOCOL_REVISION');
      if (
        (operation === 'edit' || operation === 'publish') &&
        version.status !== 'DRAFT'
      )
        throw new ConflictException('PUBLISHED_VERSION_IMMUTABLE');
      if (
        (operation === 'default' || operation === 'retire') &&
        version.status !== 'PUBLISHED'
      )
        throw new ConflictException('PUBLISHED_VERSION_REQUIRED');
      const priorDefault = await tx.organizationProtocolDefault.findUnique({
        where: {
          organizationId_route: {
            organizationId: user.organizationId,
            route: 'SUBCUTANEOUS',
          },
        },
      });
      if (operation === 'default') {
        await tx.organizationProtocolDefault.upsert({
          where: {
            organizationId_route: {
              organizationId: user.organizationId,
              route: 'SUBCUTANEOUS',
            },
          },
          create: {
            organizationId: user.organizationId,
            route: 'SUBCUTANEOUS',
            versionId: id,
          },
          update: { versionId: id },
        });
      }
      if (operation === 'retire')
        await tx.organizationProtocolDefault.deleteMany({
          where: { versionId: id },
        });
      const updated =
        operation === 'default'
          ? version
          : await tx.protocolVersion.update({
              where: { id },
              data: {
                revision: { increment: 1 },
                ...(operation === 'edit'
                  ? { definition: json(definition) }
                  : {}),
                ...(operation === 'publish'
                  ? {
                      definition: json(persistenceDefinition(version)),
                      status: 'PUBLISHED',
                      publishedAt: new Date(),
                      publishedById: user.id,
                    }
                  : {}),
                ...(operation === 'retire' ? { status: 'RETIRED' } : {}),
              },
            });
      await this.record(
        tx,
        user,
        id,
        operation === 'edit'
          ? 'PROTOCOL_DRAFT_EDITED'
          : operation === 'publish'
            ? 'PROTOCOL_PUBLISHED'
            : operation === 'retire'
              ? 'PROTOCOL_RETIRED'
              : 'PROTOCOL_DEFAULT_CHANGED',
        {
          oldValues: {
            definition: version.definition,
            status: version.status,
            defaultVersionId: priorDefault?.versionId ?? null,
          },
          newValues: {
            definition: updated.definition,
            status: updated.status,
            defaultVersionId:
              operation === 'default'
                ? id
                : operation === 'retire' && priorDefault?.versionId === id
                  ? null
                  : (priorDefault?.versionId ?? null),
          },
          changedFields:
            operation === 'default'
              ? ['defaultVersionId']
              : operation === 'edit'
                ? ['definition']
                : ['status'],
        },
      );
      return updated;
    });
  }
  async simulate(
    id: string,
    dto: SimulateProtocolDto,
    user: AuthenticatedUserPayload,
  ) {
    const version = await this.read(id, user);
    return recommendNextDose({
      protocol: persistenceDefinition(version),
      prescription: dto.prescription as ResolvedPrescription,
      administered: dto.administered as AdministeredDoseValues,
      stepId: dto.stepId,
    });
  }
  async readSettings(user: AuthenticatedUserPayload) {
    this.readAccess(user);
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
      include: { protocolDefaults: true },
    });
    return {
      enabled: organization.automationEnabled,
      timeZone: organization.timeZone,
      defaults: organization.protocolDefaults,
    };
  }
  async settings(dto: AutomationSettingsDto, user: AuthenticatedUserPayload) {
    requireClinicalAuthor(user);
    try {
      new Intl.DateTimeFormat('en', { timeZone: dto.timeZone });
    } catch {
      throw new BadRequestException('INVALID_TIME_ZONE');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${user.organizationId} FOR NO KEY UPDATE`;
      if (
        dto.enabled &&
        !(await tx.organizationProtocolDefault.findUnique({
          where: {
            organizationId_route: {
              organizationId: user.organizationId,
              route: 'SUBCUTANEOUS',
            },
          },
        }))
      )
        throw new ConflictException('PUBLISHED_DEFAULT_REQUIRED');
      const before = await tx.organization.findUniqueOrThrow({
        where: { id: user.organizationId },
      });
      const result = await tx.organization.update({
        where: { id: user.organizationId },
        data: { automationEnabled: dto.enabled, timeZone: dto.timeZone },
      });
      await this.record(
        tx,
        user,
        user.organizationId,
        'PROTOCOL_AUTOMATION_CHANGED',
        {
          oldValues: {
            enabled: before.automationEnabled,
            timeZone: before.timeZone,
          },
          newValues: { enabled: dto.enabled, timeZone: dto.timeZone },
          changedFields: ['automationEnabled', 'timeZone'],
        },
      );
      return { enabled: result.automationEnabled, timeZone: result.timeZone };
    });
  }
  private record(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUserPayload,
    id: string,
    action:
      | 'PROTOCOL_DRAFT_CREATED'
      | 'PROTOCOL_DRAFT_EDITED'
      | 'PROTOCOL_PUBLISHED'
      | 'PROTOCOL_RETIRED'
      | 'PROTOCOL_DEFAULT_CHANGED'
      | 'PROTOCOL_AUTOMATION_CHANGED',
    details: {
      oldValues?: Record<string, unknown>;
      newValues?: Record<string, unknown>;
      changedFields?: string[];
    } = {},
  ) {
    return this.audit.record(
      {
        userId: user.id,
        organizationId: user.organizationId,
        entityType:
          action === 'PROTOCOL_AUTOMATION_CHANGED'
            ? 'Organization'
            : 'TreatmentProtocol',
        entityId: id,
        action,
        ...details,
      },
      tx,
    );
  }
}
