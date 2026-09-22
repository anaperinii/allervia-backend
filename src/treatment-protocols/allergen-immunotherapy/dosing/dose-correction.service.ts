import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { json } from '../protocol-catalog/protocol-catalog.service';
import { enqueueOutbox } from 'src/notifications/notifications.service';
import { LateObservationDto, RetractDoseDto } from './dtos/dose-correction.dto';

/**
 * Correções clínicas sobre doses administradas: retratação auditada com
 * conciliação de sucessora e observação pós-aplicação tardia como registro
 * adicional imutável. Nada é apagado; a cadeia permanece reconstruível.
 */
@Injectable()
export class DoseCorrectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: IAuditLogService,
    private readonly abilities: AbilityFactory,
  ) {}

  private async lockedDose(
    tx: Prisma.TransactionClient,
    id: string,
    user: AuthenticatedUserPayload,
  ) {
    const where = accessibleBy(
      this.abilities.createForUser(user),
      'update',
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
      select: { id: true, immunotherapyId: true },
    });
    if (!initial) throw new NotFoundException();
    await tx.$queryRaw`SELECT id FROM "Immunotherapy" WHERE id = ${initial.immunotherapyId} FOR UPDATE`;
    const dose = await tx.dose.findFirst({
      where: { AND: [{ id }, where] },
      include: {
        successor: true,
        immunotherapy: { include: { patient: true } },
      },
    });
    if (!dose) throw new NotFoundException();
    return dose;
  }

  /**
   * Retratação: a aplicação registrada em erro vira ENTERED_IN_ERROR com todos
   * os valores preservados; a sucessora pendente criada por ela é arquivada e a
   * previsão original é reemitida. Sucessora já aplicada exige análise
   * explícita — nenhuma cadeia é apagada automaticamente.
   */
  async retract(
    id: string,
    dto: RetractDoseDto,
    user: AuthenticatedUserPayload,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const dose = await this.lockedDose(tx, id, user);
      if (
        dose.status !== 'ADMINISTERED_ON_SCHEDULE' &&
        dose.status !== 'ADMINISTERED_OFF_SCHEDULE'
      )
        throw new ConflictException('DOSE_NOT_ADMINISTERED');
      if (!dose.prescriptionId)
        throw new ConflictException('PROTOCOL_MIGRATION_REQUIRED');
      if (
        dose.revision !== dto.expectedRevision ||
        dose.immunotherapy.revision !== dto.expectedTherapyRevision
      )
        throw new ConflictException('STALE_CLINICAL_REVISION');
      if (dose.successor && dose.successor.administeredAt !== null)
        throw new ConflictException('SUCCESSOR_ALREADY_ADMINISTERED');

      let archivedSuccessorId: string | null = null;
      if (
        dose.successor &&
        dose.successor.status === 'SCHEDULED' &&
        !dose.successor.isArchived
      ) {
        archivedSuccessorId = dose.successor.id;
        await tx.dose.update({
          where: { id: dose.successor.id },
          data: {
            isArchived: true,
            archivedAt: new Date(),
            archivedById: user.id,
          },
        });
      }

      const retracted = await tx.dose.update({
        where: { id },
        data: {
          status: 'ENTERED_IN_ERROR',
          revision: { increment: 1 },
          updatedById: user.id,
        },
      });

      // A previsão original volta a existir como estava planejada; a decisão
      // clínica seguinte (editar/administrar) usa os comandos normais.
      const reissued = await tx.dose.create({
        data: {
          immunotherapyId: dose.immunotherapyId,
          prescriptionId: dose.prescriptionId,
          plannedStepId: dose.plannedStepId,
          plannedValues: dose.plannedValues ?? undefined,
          plannedVolumeExact: dose.plannedVolumeExact,
          concentration: dose.concentration,
          volume: dose.volume,
          nextIntervalInDays: dose.nextIntervalInDays,
          scheduledAt: dose.scheduledAt,
          betweenDosesReport: '',
          createdById: user.id,
          updatedById: user.id,
        },
      });
      const therapy = await tx.immunotherapy.update({
        where: { id: dose.immunotherapyId },
        data: { revision: { increment: 1 }, updatedById: user.id },
      });
      await this.audit.record(
        {
          userId: user.id,
          organizationId: user.organizationId,
          entityType: 'Dose',
          entityId: id,
          action: 'DOSE_RETRACTED',
          oldValues: { status: dose.status },
          newValues: {
            status: 'ENTERED_IN_ERROR',
            reason: dto.reason,
            archivedSuccessorId,
            reissuedDoseId: reissued.id,
            administeredValuesPreserved: true,
          },
          changedFields: ['status'],
        },
        tx,
      );
      return {
        dose: retracted,
        archivedSuccessorId,
        reissuedDose: reissued,
        therapyRevision: therapy.revision,
      };
    });
  }

  /**
   * Observação pós-aplicação tardia: registro adicional com autoria e instante
   * próprios. Conduta SUSPEND_TREATMENT executa a suspensão na MESMA transação
   * (comando composto) e exige poder de revisão sobre a terapia.
   */
  async addLateObservation(
    id: string,
    dto: LateObservationDto,
    user: AuthenticatedUserPayload,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const dose = await this.lockedDose(tx, id, user);
      if (
        dose.status !== 'ADMINISTERED_ON_SCHEDULE' &&
        dose.status !== 'ADMINISTERED_OFF_SCHEDULE'
      )
        throw new ConflictException('DOSE_NOT_ADMINISTERED');
      const observedAt = new Date(dto.observedAt);
      if (
        !Number.isFinite(observedAt.getTime()) ||
        (dose.administeredAt && observedAt < dose.administeredAt) ||
        observedAt.getTime() > Date.now()
      )
        throw new BadRequestException('INVALID_OBSERVATION_TIME');

      const conduct = dto.conduct ?? null;
      if (
        conduct &&
        conduct.type !== 'MAINTAIN' &&
        !conduct.justification?.trim()
      )
        throw new BadRequestException('CONDUCT_JUSTIFICATION_REQUIRED');

      let suspension: { id: string } | null = null;
      if (conduct?.type === 'SUSPEND_TREATMENT') {
        const ability = this.abilities.createForUser(user);
        const allowed =
          ability.can('update', 'Immunotherapy') &&
          (await tx.immunotherapy.count({
            where: {
              AND: [
                { id: dose.immunotherapyId },
                accessibleBy(ability, 'update').ofType('Immunotherapy'),
              ],
            },
          })) > 0;
        if (!allowed)
          throw new ForbiddenException('CONDUCT_REQUIRES_PHYSICIAN');
        if (dose.immunotherapy.status !== 'IN_PROGRESS')
          throw new ConflictException('INVALID_LIFECYCLE_TRANSITION');
        if (dose.immunotherapy.revision !== dto.expectedTherapyRevision)
          throw new ConflictException('STALE_CLINICAL_REVISION');
        suspension = await tx.therapyLifecycleEvent.create({
          data: {
            immunotherapyId: dose.immunotherapyId,
            type: 'SUSPENSION',
            category: 'late_adverse_reaction',
            reason: conduct.justification!,
            createdById: user.id,
          },
        });
        await tx.immunotherapy.update({
          where: { id: dose.immunotherapyId },
          data: {
            status: 'SUSPENDED',
            revision: { increment: 1 },
            updatedById: user.id,
          },
        });
      }

      if (conduct?.type === 'REQUEST_PHYSICIAN_REVIEW')
        await enqueueOutbox(
          tx,
          user.organizationId,
          'PHYSICIAN_REVIEW_REQUESTED',
          {
            therapyId: dose.immunotherapyId,
            patientId: dose.immunotherapy.patient.id,
            patientName: dose.immunotherapy.patient.fullName,
            doseId: id,
            reason: conduct.justification ?? '',
            recipientProfessionalId:
              dose.immunotherapy.patient.responsiblePhysicianId,
          },
        );

      const addendum = await tx.doseObservationAddendum.create({
        data: {
          doseId: id,
          reportedSideEffects: dto.reportedSideEffects,
          administeredMedications: dto.administeredMedications,
          notes: dto.notes ?? null,
          observedAt,
          conduct: conduct?.type ?? null,
          conductJustification: conduct?.justification ?? null,
          createdById: user.id,
        },
      });
      await this.audit.record(
        {
          userId: user.id,
          organizationId: user.organizationId,
          entityType: 'Dose',
          entityId: id,
          action: 'DOSE_OBSERVATION_ADDED',
          newValues: json({
            addendumId: addendum.id,
            observedAt: observedAt.toISOString(),
            conduct: conduct?.type ?? null,
            suspensionEventId: suspension?.id ?? null,
          }) as Record<string, unknown>,
        },
        tx,
      );
      return { addendum, suspensionEventId: suspension?.id ?? null };
    });
  }
}
