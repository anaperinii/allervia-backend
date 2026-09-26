import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { CreatePatientUseCase } from 'src/patients/use-cases/create-patient.use-case';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { CreateImmunotherapyDto } from '../dtos/create-immunotherapy.dto';
import {
  json,
  persistenceDefinition,
  requireClinicalAuthor,
} from '../../protocol-catalog/protocol-catalog.service';
import {
  plannedDoseData,
  prescriptionFromJson,
} from '../../dosing/configured-dose.service';

export interface RegistrationResult {
  patient: { id: string } & Record<string, unknown>;
  immunotherapy: {
    id: string;
    patientId: string;
    prescription: { id: string; versionId: string } & Record<string, unknown>;
    targetVolumeExact?: { toString(): string } | null;
  } & Record<string, unknown>;
  firstDose: {
    id: string;
    plannedValues?: unknown;
  } & Record<string, unknown>;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

@Injectable()
export class CreateImmunotherapyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: CreatePatientUseCase,
    private readonly audit: IAuditLogService,
  ) {}

  async execute(
    dto: CreateImmunotherapyDto,
    user: AuthenticatedUserPayload,
  ): Promise<RegistrationResult> {
    requireClinicalAuthor(user);
    if (dto.administrationRoute !== 'SUBCUTANEOUS')
      throw new BadRequestException('UNSUPPORTED_AUTOMATION_ROUTE');
    if (Boolean(dto.patient) === Boolean(dto.patientId))
      throw new BadRequestException('PATIENT_XOR_PATIENT_ID_REQUIRED');
    if (!dto.idempotencyKey?.trim())
      throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');

    const { idempotencyKey, ...intent } = dto;
    const requestHash = createHash('sha256')
      .update(JSON.stringify(canonical(intent)))
      .digest('hex');

    return this.prisma.$transaction(async (tx) => {
      const commandKey = {
        organizationId: user.organizationId,
        actorId: user.id,
        key: idempotencyKey,
      };
      const previous = await tx.registrationCommand.findUnique({
        where: { organizationId_actorId_key: commandKey },
      });
      if (previous) {
        if (previous.requestHash !== requestHash)
          throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
        return previous.result as unknown as RegistrationResult;
      }

      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${user.organizationId} FOR SHARE`;
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: user.organizationId },
      });
      if (!organization.automationEnabled)
        throw new ConflictException('AUTOMATION_DISABLED');

      const defaultVersion = dto.protocolVersionId
        ? null
        : await tx.organizationProtocolDefault.findUnique({
            where: {
              organizationId_route: {
                organizationId: user.organizationId,
                route: dto.administrationRoute,
              },
            },
          });
      const versionId = dto.protocolVersionId ?? defaultVersion?.versionId;
      if (!versionId)
        throw new ConflictException('PUBLISHED_PROTOCOL_REQUIRED');
      await tx.$queryRaw`SELECT id FROM "ProtocolVersion" WHERE id = ${versionId} AND "organizationId" = ${user.organizationId} FOR SHARE`;
      const version = await tx.protocolVersion.findFirst({
        where: {
          id: versionId,
          organizationId: user.organizationId,
          status: 'PUBLISHED',
          protocol: { available: true, route: dto.administrationRoute },
        },
      });
      if (!version) throw new NotFoundException('PUBLISHED_PROTOCOL_NOT_FOUND');
      const protocol = persistenceDefinition(version);
      const resolved = prescriptionFromJson(
        {
          protocolId: protocol.protocolId,
          protocolVersionId: version.id,
          route: protocol.route,
          startingStepId: dto.startingStepId,
          targetStepId: dto.targetStepId,
          stepIds: dto.stepIds,
        },
        protocol,
      );

      const patient = await this.resolvePatient(tx, dto, user);

      const target = protocol.steps.find(
        (step) => step.id === resolved.targetStepId,
      )!;
      const first = protocol.steps.find(
        (step) => step.id === resolved.startingStepId,
      )!;
      const therapy = await tx.immunotherapy.create({
        data: {
          patientId: patient.id,
          immunoType: dto.immunoType,
          administrationRoute: dto.administrationRoute,
          extract: dto.extract,
          inductionStartDate: new Date(dto.inductionStartDate),
          targetConcentration: Number(target.concentration),
          targetVolume: Number(target.volume),
          targetVolumeExact: new Prisma.Decimal(target.volume),
          createdById: user.id,
          updatedById: user.id,
        },
      });
      const prescription = await tx.protocolPrescription.create({
        data: {
          immunotherapyId: therapy.id,
          organizationId: user.organizationId,
          versionId: version.id,
          resolved: json({ ...resolved, timeZone: organization.timeZone }),
          createdById: user.id,
        },
      });
      await tx.immunotherapy.update({
        where: { id: therapy.id },
        data: { currentPrescriptionId: prescription.id },
      });
      const dose = await tx.dose.create({
        data: plannedDoseData(
          first,
          protocol,
          prescription.id,
          therapy.id,
          therapy.inductionStartDate,
          user.id,
        ),
      });
      await this.audit.record(
        {
          userId: user.id,
          organizationId: user.organizationId,
          entityType: 'Immunotherapy',
          entityId: therapy.id,
          action: 'PRESCRIPTION_CREATED',
          newValues: {
            prescriptionId: prescription.id,
            protocolVersionId: version.id,
            resolved,
          },
        },
        tx,
      );

      const result = {
        patient,
        immunotherapy: { ...therapy, prescription },
        firstDose: dose,
      } as unknown as RegistrationResult;

      await tx.registrationCommand.create({
        data: {
          ...commandKey,
          requestHash,
          result: json(result),
        },
      });

      return result;
    });
  }

  private async resolvePatient(
    tx: Prisma.TransactionClient,
    dto: CreateImmunotherapyDto,
    user: AuthenticatedUserPayload,
  ) {
    if (dto.patient) {
      if (dto.patient.responsiblePhysicianId !== user.professionalId)
        throw new BadRequestException(
          'PRESCRIBER_MUST_BE_RESPONSIBLE_PHYSICIAN',
        );
      const professional = await tx.professional.findFirst({
        where: {
          id: dto.patient.responsiblePhysicianId,
          organizationId: user.organizationId,
          user: { isActive: true, isArchived: false },
        },
      });
      if (!professional)
        throw new NotFoundException('RESPONSIBLE_PHYSICIAN_NOT_FOUND');
      return this.patients.execute(dto.patient, user, tx);
    }

    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Patient" WHERE id = ${dto.patientId} AND "organizationId" = ${user.organizationId} FOR UPDATE`;
    if (!rows.length) throw new NotFoundException('PATIENT_NOT_FOUND');

    const patient = await tx.patient.findUniqueOrThrow({
      where: { id: dto.patientId },
    });

    if (patient.isArchived || !patient.isActive)
      throw new ConflictException('PATIENT_INACTIVE');
    if (patient.responsiblePhysicianId !== user.professionalId)
      throw new BadRequestException('PRESCRIBER_MUST_BE_RESPONSIBLE_PHYSICIAN');

    return patient;
  }
}
