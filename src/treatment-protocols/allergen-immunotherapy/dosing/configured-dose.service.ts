import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { createHash } from 'node:crypto';
import { Prisma, Role, TherapyStatus } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import {
  addProtocolCalendarDays,
  localCalendarDay,
} from 'src/utils/protocol-calendar';
import {
  persistenceDefinition,
  json,
} from '../protocol-catalog/protocol-catalog.service';
import { enqueueOutbox } from 'src/notifications/notifications.service';
import {
  validateResolvedPrescription,
  ProtocolValidationError,
} from '../clinical-rules/protocol-definition.validator';
import { resolveProtocolStep } from '../clinical-rules/resolve-protocol-step';
import { recommendNextDose } from '../clinical-rules/recommend-next-dose';
import type {
  AdministeredDoseValues,
  ProtocolStep,
  PublishedProtocolDefinition,
  ResolvedPrescription,
} from '../clinical-rules/protocol-definition';
import {
  AdministerDoseDto,
  ConfiguredDoseValuesDto,
  DosePreviewDto,
  DoseRevisionDto,
  UpdateScheduledDoseDto,
} from './dtos/configured-dose.dto';

export function configuredValues(
  step: ProtocolStep,
  protocol: PublishedProtocolDefinition,
): AdministeredDoseValues {
  return {
    concentration: step.concentration,
    volume: step.volume,
    intervalDays: step.intervalDays,
    phase: step.phase,
    route: protocol.route,
    volumeUnit: protocol.volumeUnit,
    concentrationUnit: protocol.concentrationUnit,
  };
}
export function prescriptionFromJson(
  value: unknown,
  protocol: PublishedProtocolDefinition,
): ResolvedPrescription {
  try {
    return validateResolvedPrescription(value, protocol);
  } catch (error) {
    if (error instanceof ProtocolValidationError)
      throw new BadRequestException({
        code: 'INVALID_PRESCRIPTION',
        detail: error.message,
      });
    throw error;
  }
}
export function plannedDoseData(
  step: ProtocolStep,
  protocol: PublishedProtocolDefinition,
  prescriptionId: string,
  therapyId: string,
  scheduledAt: Date,
  userId: string,
) {
  return {
    prescriptionId,
    immunotherapyId: therapyId,
    plannedStepId: step.id,
    plannedValues: json(configuredValues(step, protocol)),
    plannedVolumeExact: new Prisma.Decimal(step.volume),
    concentration: Number(step.concentration),
    volume: Number(step.volume),
    nextIntervalInDays: step.intervalDays,
    scheduledAt,
    betweenDosesReport: '',
    createdById: userId,
    updatedById: userId,
  };
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}

@Injectable()
export class ConfiguredDoseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: IAuditLogService,
    private readonly abilities: AbilityFactory,
  ) {}

  async lockTherapy(
    tx: Prisma.TransactionClient,
    id: string,
    user: AuthenticatedUserPayload,
    action: 'read' | 'update' = 'update',
  ) {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${user.organizationId} FOR SHARE`;
    const ability = this.abilities.createForUser(user);
    // Nurses can update doses, but not the therapy itself. Sem NENHUMA regra o
    // CASL devolve `{OR: []}` e o Prisma o ignora dentro de AND — o pre-check
    // impede que a ausência de permissão vire acesso total.
    if (!ability.can(action, 'Immunotherapy')) throw new NotFoundException();
    const where = accessibleBy(ability, action).ofType('Immunotherapy');
    const therapy = await tx.immunotherapy.findFirst({
      where: {
        AND: [{ id, patient: { organizationId: user.organizationId } }, where],
      },
    });
    if (!therapy) throw new NotFoundException();
    await tx.$queryRaw`SELECT id FROM "Immunotherapy" WHERE id = ${id} FOR UPDATE`;
    await tx.$queryRaw`SELECT p.id FROM "Patient" p JOIN "Immunotherapy" i ON i."patientId" = p.id WHERE i.id = ${id} FOR SHARE OF p`;
    const current = await tx.immunotherapy.findFirst({
      where: {
        AND: [{ id, patient: { organizationId: user.organizationId } }, where],
      },
      include: {
        patient: true,
        currentPrescription: { include: { version: true } },
      },
    });
    if (!current) throw new NotFoundException();
    return current;
  }

  private async context(
    tx: Prisma.TransactionClient,
    id: string,
    user: AuthenticatedUserPayload,
    action: 'read' | 'update',
  ) {
    const where = accessibleBy(
      this.abilities.createForUser(user),
      action,
    ).ofType('Dose');
    const initial = await tx.dose.findFirst({
      where: {
        AND: [
          {
            id,
            immunotherapy: { patient: { organizationId: user.organizationId } },
          },
          where,
        ],
      },
    });
    if (!initial) throw new NotFoundException();
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${user.organizationId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "Immunotherapy" WHERE id = ${initial.immunotherapyId} FOR UPDATE`;
    await tx.$queryRaw`SELECT p.id FROM "Patient" p JOIN "Immunotherapy" i ON i."patientId" = p.id WHERE i.id = ${initial.immunotherapyId} FOR SHARE OF p`;
    const dose = await tx.dose.findFirst({
      where: { AND: [{ id }, where] },
      include: {
        immunotherapy: {
          include: {
            patient: true,
            currentPrescription: { include: { version: true } },
          },
        },
      },
    });
    if (!dose) throw new NotFoundException();
    const organization = await tx.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
    });
    const therapy = dose.immunotherapy;
    if (
      !therapy.currentPrescription ||
      !dose.prescriptionId ||
      dose.prescriptionId !== therapy.currentPrescription.id
    )
      throw new ConflictException('PROTOCOL_MIGRATION_REQUIRED');
    const protocol = persistenceDefinition(therapy.currentPrescription.version);
    const prescription = prescriptionFromJson(
      therapy.currentPrescription.resolved,
      protocol,
    );
    const timeZone = (
      therapy.currentPrescription.resolved as Record<string, unknown>
    ).timeZone;
    if (typeof timeZone !== 'string')
      throw new ConflictException('PRESCRIPTION_TIME_ZONE_REQUIRED');
    return { dose, therapy, organization, protocol, prescription, timeZone };
  }

  private active(
    context: Awaited<ReturnType<ConfiguredDoseService['context']>>,
    dto: DoseRevisionDto,
  ) {
    const { dose, therapy, organization } = context;
    if (!organization.automationEnabled)
      throw new ConflictException('AUTOMATION_DISABLED');
    if (
      therapy.status !== 'IN_PROGRESS' ||
      therapy.isArchived ||
      !therapy.patient.isActive ||
      therapy.patient.isArchived
    )
      throw new ConflictException('TREATMENT_NOT_ACTIVE');
    if (dose.status !== 'SCHEDULED' || dose.isArchived)
      throw new ConflictException('DOSE_NOT_SCHEDULED');
    if (
      dose.revision !== dto.expectedRevision ||
      therapy.revision !== dto.expectedTherapyRevision
    )
      throw new ConflictException('STALE_CLINICAL_REVISION');
  }
  private resolve(
    context: Awaited<ReturnType<ConfiguredDoseService['context']>>,
    values: ConfiguredDoseValuesDto,
  ) {
    if (!values) throw new BadRequestException('DOSE_VALUES_REQUIRED');
    const administered = {
      ...values,
      route: context.protocol.route,
      volumeUnit: context.protocol.volumeUnit,
      concentrationUnit: context.protocol.concentrationUnit,
    };
    const input = {
      protocol: context.protocol,
      prescription: context.prescription,
      administered,
      stepId: values.stepId,
    };
    const resolution = resolveProtocolStep(input);
    if (resolution.kind === 'UNRESOLVED')
      throw new BadRequestException(resolution);
    return { step: resolution.step, input };
  }
  private date(value: string) {
    const result = new Date(value);
    if (
      !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
      !Number.isFinite(result.getTime())
    )
      throw new BadRequestException('TIMESTAMP_WITH_OFFSET_REQUIRED');
    return result;
  }
  private nextDate(date: Date, days: number, zone: string) {
    try {
      return addProtocolCalendarDays(date, days, zone);
    } catch {
      throw new BadRequestException('SCHEDULE_REQUIRES_CALENDAR_REVIEW');
    }
  }
  /**
   * Executor da aplicação. O registrador é sempre o usuário autenticado
   * (administeredById); registrar em nome de terceiro exige vínculo ativo com a
   * organização e papel clínico — nome livre não identifica ninguém.
   */
  private async resolvePerformer(
    tx: Prisma.TransactionClient,
    requested: string | undefined,
    user: AuthenticatedUserPayload,
  ) {
    if (!requested || requested === user.professionalId) {
      if (!user.professionalId)
        throw new BadRequestException('PERFORMER_REQUIRED');
      return user.professionalId;
    }
    const performer = await tx.professional.findFirst({
      where: {
        id: requested,
        organizationId: user.organizationId,
        user: { isActive: true, isArchived: false },
        professionalRoles: {
          some: { role: { in: [Role.PHYSICIAN, Role.NURSE] }, revokedAt: null },
        },
      },
      select: { id: true },
    });
    if (!performer) throw new BadRequestException('PERFORMER_NOT_AUTHORIZED');
    return performer.id;
  }
  async read(id: string, user: AuthenticatedUserPayload) {
    const where = accessibleBy(
      this.abilities.createForUser(user),
      'read',
    ).ofType('Dose');
    const dose = await this.prisma.dose.findFirst({
      where: {
        AND: [
          {
            id,
            immunotherapy: { patient: { organizationId: user.organizationId } },
          },
          where,
        ],
      },
      include: {
        immunotherapy: {
          include: { currentPrescription: { include: { version: true } } },
        },
        observations: true,
        observationAddenda: { orderBy: { observedAt: 'asc' } },
      },
    });
    if (!dose) throw new NotFoundException();
    const saved = dose.immunotherapy.currentPrescription;
    const protocol = saved ? persistenceDefinition(saved.version) : null;
    const prescription =
      saved && protocol ? prescriptionFromJson(saved.resolved, protocol) : null;
    return {
      ...dose,
      protocolVersionId: saved?.versionId ?? null,
      prescriptionRevision: saved?.revision ?? null,
      therapyRevision: dose.immunotherapy.revision,
      allowedValues:
        protocol?.steps.filter((step) =>
          prescription!.stepIds.includes(step.id),
        ) ?? [],
      migrationRequired: !saved,
    };
  }
  async preview(
    id: string,
    dto: DosePreviewDto,
    user: AuthenticatedUserPayload,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const context = await this.context(tx, id, user, 'read');
      this.active(context, dto);
      const { input } = this.resolve(context, dto.values);
      const recommendation = recommendNextDose(input);
      if (recommendation.kind === 'UNRESOLVED')
        throw new BadRequestException(recommendation);
      const date = this.date(dto.administeredAt);
      return {
        recommendation,
        allowedValues: context.protocol.steps.filter((step) =>
          context.prescription.stepIds.includes(step.id),
        ),
        nextScheduledAt:
          recommendation.kind === 'RECOMMENDED'
            ? this.nextDate(
                date,
                recommendation.values.intervalDays,
                context.timeZone,
              )
            : null,
        expectedRevision: context.dose.revision,
        expectedTherapyRevision: context.therapy.revision,
        prescriptionRevision: context.therapy.currentPrescription!.revision,
        protocolVersionId: context.protocol.versionId,
      };
    });
  }
  async edit(
    id: string,
    dto: UpdateScheduledDoseDto,
    user: AuthenticatedUserPayload,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const context = await this.context(tx, id, user, 'update');
      this.active(context, dto);
      const { step } = this.resolve(context, dto.values);
      if (!dto.reason?.trim())
        throw new BadRequestException('ADJUSTMENT_REASON_REQUIRED');
      const updated = await tx.dose.update({
        where: { id },
        data: {
          plannedStepId: step.id,
          plannedValues: json(configuredValues(step, context.protocol)),
          plannedVolumeExact: new Prisma.Decimal(step.volume),
          concentration: Number(step.concentration),
          volume: Number(step.volume),
          nextIntervalInDays: step.intervalDays,
          scheduledAt: this.date(dto.scheduledAt),
          revision: { increment: 1 },
          updatedById: user.id,
        },
      });
      const therapy = await tx.immunotherapy.update({
        where: { id: context.therapy.id },
        data: { revision: { increment: 1 }, updatedById: user.id },
      });
      await this.audit.record(
        {
          userId: user.id,
          organizationId: user.organizationId,
          entityType: 'Dose',
          entityId: id,
          action: 'DOSE_SCHEDULE_EDITED',
          oldValues: {
            values: context.dose.plannedValues,
            scheduledAt: context.dose.scheduledAt.toISOString(),
          },
          newValues: {
            values: updated.plannedValues,
            scheduledAt: updated.scheduledAt.toISOString(),
            reason: dto.reason,
          },
          changedFields: ['plannedValues', 'scheduledAt'],
        },
        tx,
      );
      return { ...updated, therapyRevision: therapy.revision };
    });
  }
  async administer(
    id: string,
    dto: AdministerDoseDto,
    user: AuthenticatedUserPayload,
  ) {
    if (!dto.idempotencyKey?.trim())
      throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
    const hash = createHash('sha256')
      .update(JSON.stringify(canonical(dto)))
      .digest('hex');
    return this.prisma.$transaction(
      async (tx) => {
        const context = await this.context(tx, id, user, 'update');
        const key = {
          organizationId: user.organizationId,
          actorId: user.id,
          doseId: id,
          key: dto.idempotencyKey,
        };
        const previous = await tx.clinicalCommand.findUnique({
          where: { organizationId_actorId_doseId_key: key },
        });
        if (previous) {
          if (previous.requestHash !== hash)
            throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
          return previous.result;
        }
        this.active(context, dto);
        const { step, input } = this.resolve(context, dto.values);
        const administeredAt = this.date(dto.administeredAt);
        if (administeredAt.getTime() > Date.now())
          throw new BadRequestException('ADMINISTRATION_IN_FUTURE');
        const preceding = await tx.dose.findFirst({
          where: {
            immunotherapyId: context.therapy.id,
            administeredAt: { not: null },
            status: {
              in: ['ADMINISTERED_ON_SCHEDULE', 'ADMINISTERED_OFF_SCHEDULE'],
            },
          },
          orderBy: { administeredAt: 'desc' },
        });
        if (
          administeredAt < context.therapy.inductionStartDate ||
          (preceding?.administeredAt &&
            administeredAt < preceding.administeredAt)
        )
          throw new ConflictException('INVALID_ADMINISTRATION_CHRONOLOGY');
        if (context.dose.plannedStepId !== step.id && !dto.reason?.trim())
          throw new BadRequestException('ADJUSTMENT_REASON_REQUIRED');
        const administrationEndedAt = dto.administrationEndedAt
          ? this.date(dto.administrationEndedAt)
          : null;
        if (administrationEndedAt) {
          if (administrationEndedAt.getTime() > Date.now())
            throw new BadRequestException('ADMINISTRATION_IN_FUTURE');
          if (administrationEndedAt < administeredAt)
            throw new BadRequestException('INVALID_ADMINISTRATION_WINDOW');
        }
        const performerId = await this.resolvePerformer(
          tx,
          dto.performedById,
          user,
        );
        const conduct = dto.immediateConduct ?? null;
        if (
          conduct &&
          conduct.type !== 'MAINTAIN' &&
          !conduct.justification?.trim()
        )
          throw new BadRequestException('CONDUCT_JUSTIFICATION_REQUIRED');
        if (conduct?.type === 'SUSPEND_TREATMENT') {
          // Suspender é decisão sobre o tratamento, não sobre a dose: quem não
          // pode revisar a terapia solicita avaliação médica em vez de suspender.
          const ability = this.abilities.createForUser(user);
          const allowed =
            ability.can('update', 'Immunotherapy') &&
            (await tx.immunotherapy.count({
              where: {
                AND: [
                  { id: context.therapy.id },
                  accessibleBy(ability, 'update').ofType('Immunotherapy'),
                ],
              },
            })) > 0;
          if (!allowed)
            throw new ForbiddenException('CONDUCT_REQUIRES_PHYSICIAN');
        }
        const recommendation = recommendNextDose(input);
        if (recommendation.kind === 'UNRESOLVED')
          throw new BadRequestException(recommendation);
        const updated = await tx.dose.update({
          where: { id },
          data: {
            administeredAt,
            administrationEndedAt,
            administeredById: user.id,
            performedById: performerId,
            immediateConduct: conduct?.type ?? null,
            immediateConductJustification: conduct?.justification ?? null,
            administeredStepId: step.id,
            administeredValues: json(configuredValues(step, context.protocol)),
            administeredVolumeExact: new Prisma.Decimal(step.volume),
            betweenDosesReport: dto.betweenDosesReport,
            status:
              localCalendarDay(context.dose.scheduledAt, context.timeZone) ===
              localCalendarDay(administeredAt, context.timeZone)
                ? 'ADMINISTERED_ON_SCHEDULE'
                : 'ADMINISTERED_OFF_SCHEDULE',
            recommendation: json(recommendation),
            revision: { increment: 1 },
            updatedById: user.id,
          },
        });
        const phases = new Set<string>();
        for (const observation of dto.observations ?? []) {
          if (phases.has(observation.phase))
            throw new BadRequestException('DUPLICATE_OBSERVATION_PHASE');
          phases.add(observation.phase);
          await tx.doseObservation.create({
            data: { ...observation, doseId: id },
          });
        }
        const successor =
          recommendation.kind === 'RECOMMENDED'
            ? await tx.dose.create({
                data: {
                  ...plannedDoseData(
                    context.protocol.steps.find(
                      (candidate) => candidate.id === recommendation.stepId,
                    )!,
                    context.protocol,
                    context.dose.prescriptionId!,
                    context.therapy.id,
                    this.nextDate(
                      administeredAt,
                      recommendation.values.intervalDays,
                      context.timeZone,
                    ),
                    user.id,
                  ),
                  sourceDoseId: id,
                },
              })
            : null;
        const therapy = await tx.immunotherapy.update({
          where: { id: context.therapy.id },
          data: {
            revision: { increment: 1 },
            updatedById: user.id,
            ...(step.phase === 'MAINTENANCE' &&
            !context.therapy.maintenanceStartDate
              ? { maintenanceStartDate: administeredAt }
              : {}),
            ...(conduct?.type === 'SUSPEND_TREATMENT'
              ? { status: TherapyStatus.SUSPENDED }
              : {}),
          },
        });
        if (conduct?.type === 'SUSPEND_TREATMENT')
          await this.audit.record(
            {
              userId: user.id,
              organizationId: user.organizationId,
              entityType: 'Immunotherapy',
              entityId: context.therapy.id,
              action: 'IMMUNOTHERAPY_STATUS_CHANGED',
              oldValues: { status: context.therapy.status },
              newValues: {
                status: TherapyStatus.SUSPENDED,
                reason: conduct.justification,
              },
              changedFields: ['status'],
            },
            tx,
          );
        // O pedido de avaliação nasce no MESMO commit da aplicação (outbox);
        // a notificação interna é materializada pelo consumidor.
        if (conduct?.type === 'REQUEST_PHYSICIAN_REVIEW')
          await enqueueOutbox(
            tx,
            user.organizationId,
            'PHYSICIAN_REVIEW_REQUESTED',
            {
              therapyId: context.therapy.id,
              patientId: context.therapy.patient.id,
              patientName: context.therapy.patient.fullName,
              doseId: id,
              reason: conduct.justification ?? '',
              recipientProfessionalId:
                context.therapy.patient.responsiblePhysicianId,
            },
          );
        await this.audit.record(
          {
            userId: user.id,
            organizationId: user.organizationId,
            entityType: 'Dose',
            entityId: id,
            action: 'DOSE_ADMINISTERED',
            newValues: {
              administered: updated.administeredValues,
              administeredAt: administeredAt.toISOString(),
              administrationEndedAt:
                administrationEndedAt?.toISOString() ?? null,
              performedById: performerId,
              immediateConduct: conduct?.type ?? null,
              reason: dto.reason ?? null,
              recommendation,
              successorId: successor?.id ?? null,
            },
            changedFields: ['administeredValues', 'status', 'recommendation'],
          },
          tx,
        );
        const result = json({
          dose: updated,
          successor,
          recommendation,
          therapyRevision: therapy.revision,
        });
        await tx.clinicalCommand.create({
          data: { ...key, requestHash: hash, result },
        });
        return result;
      },
      { maxWait: 10000, timeout: 15000 },
    );
  }
  async therapyStatus(
    id: string,
    status: TherapyStatus,
    expectedRevision: number,
    user: AuthenticatedUserPayload,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const therapy = await this.lockTherapy(tx, id, user);
      if (therapy.revision !== expectedRevision)
        throw new ConflictException('STALE_CLINICAL_REVISION');
      if (therapy.status === status)
        throw new BadRequestException('UNCHANGED_THERAPY_STATUS');
      const result = await tx.immunotherapy.update({
        where: { id },
        data: { status, revision: { increment: 1 }, updatedById: user.id },
      });
      await this.audit.record(
        {
          userId: user.id,
          organizationId: user.organizationId,
          entityType: 'Immunotherapy',
          entityId: id,
          action: 'IMMUNOTHERAPY_STATUS_CHANGED',
          oldValues: { status: therapy.status },
          newValues: { status },
          changedFields: ['status'],
        },
        tx,
      );
      return result;
    });
  }
  async rejectLegacyWrite(
    id: string,
    user: AuthenticatedUserPayload,
  ): Promise<never> {
    await this.read(id, user);
    throw new GoneException(
      'Use scheduled, preview and administer commands. Retraction requires a dedicated clinical revision.',
    );
  }
}
