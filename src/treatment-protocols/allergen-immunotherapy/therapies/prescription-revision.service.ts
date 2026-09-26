import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import {
  ConfiguredDoseService,
  configuredValues,
  prescriptionFromJson,
} from '../dosing/configured-dose.service';
import {
  json,
  persistenceDefinition,
  requireClinicalAuthor,
} from '../protocol-catalog/protocol-catalog.service';
import type { ResolvedPrescription } from '../clinical-rules/protocol-definition';
import { PrescriptionRevisionDto } from './dtos/prescription-revision.dto';

@Injectable()
export class PrescriptionRevisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clinical: ConfiguredDoseService,
    private readonly audit: IAuditLogService,
  ) {}

  async revise(
    id: string,
    dto: PrescriptionRevisionDto,
    user: AuthenticatedUserPayload,
  ) {
    requireClinicalAuthor(user);
    const dryRun = dto.dryRun !== false;
    return this.prisma.$transaction(async (tx) => {
      const therapy = await this.clinical.lockTherapy(tx, id, user);
      if (!therapy.currentPrescription)
        throw new ConflictException('PROTOCOL_MIGRATION_REQUIRED');
      if (therapy.revision !== dto.expectedRevision)
        throw new ConflictException('STALE_CLINICAL_REVISION');
      if (therapy.status !== 'IN_PROGRESS')
        throw new ConflictException('TREATMENT_NOT_ACTIVE');
      if (therapy.currentPrescription.versionId === dto.targetVersionId)
        throw new ConflictException('REVISION_TARGETS_SAME_VERSION');

      await tx.$queryRaw`SELECT id FROM "ProtocolVersion" WHERE id = ${dto.targetVersionId} AND "organizationId" = ${user.organizationId} FOR SHARE`;
      const version = await tx.protocolVersion.findFirst({
        where: {
          id: dto.targetVersionId,
          organizationId: user.organizationId,
          status: 'PUBLISHED',
        },
      });
      if (!version) throw new NotFoundException();
      const protocol = persistenceDefinition(version);
      const resolved = prescriptionFromJson(
        dto.prescription as ResolvedPrescription,
        protocol,
      );

      const pendingStep = protocol.steps.find(
        (step) => step.id === dto.pendingStepId,
      );
      if (!pendingStep || !resolved.stepIds.includes(pendingStep.id))
        throw new BadRequestException({
          kind: 'UNRESOLVED',
          code: 'STEP_NOT_IN_PRESCRIPTION',
        });

      const pending = await tx.dose.findMany({
        where: { immunotherapyId: id, status: 'SCHEDULED', isArchived: false },
      });
      if (pending.length !== 1)
        throw new ConflictException('PENDING_DOSE_REQUIRES_REVIEW');
      const dose = pending[0];

      const target = protocol.steps.find(
        (step) => step.id === resolved.targetStepId,
      )!;

      if (dryRun)
        return {
          dryRun: true,
          therapyId: id,
          pendingDoseId: dose.id,
          previousVersionId: therapy.currentPrescription.versionId,
          targetVersionId: version.id,
          pendingStep: {
            id: pendingStep.id,
            label: pendingStep.label,
            concentration: pendingStep.concentration,
            volume: pendingStep.volume,
            intervalDays: pendingStep.intervalDays,
          },
          scheduledAtUnchanged: dose.scheduledAt.toISOString(),
          historicalDosesUnchanged: true,
        };

      const timeZone = (
        therapy.currentPrescription.resolved as Record<string, unknown>
      ).timeZone;
      const snapshot = await tx.protocolPrescription.create({
        data: {
          immunotherapyId: id,
          organizationId: user.organizationId,
          versionId: version.id,
          resolved: json({ ...resolved, timeZone }),
          revisionReason: dto.reason,
          createdById: user.id,
        },
      });
      const updatedDose = await tx.dose.update({
        where: { id: dose.id },
        data: {
          prescriptionId: snapshot.id,
          plannedStepId: pendingStep.id,
          plannedValues: json(configuredValues(pendingStep, protocol)),
          plannedVolumeExact: new Prisma.Decimal(pendingStep.volume),
          concentration: Number(pendingStep.concentration),
          volume: Number(pendingStep.volume),
          nextIntervalInDays: pendingStep.intervalDays,
          revision: { increment: 1 },
          updatedById: user.id,
        },
      });
      const updatedTherapy = await tx.immunotherapy.update({
        where: { id },
        data: {
          currentPrescriptionId: snapshot.id,
          targetVolumeExact: new Prisma.Decimal(target.volume),
          revision: { increment: 1 },
          updatedById: user.id,
        },
      });
      await this.audit.record(
        {
          userId: user.id,
          organizationId: user.organizationId,
          entityType: 'Immunotherapy',
          entityId: id,
          action: 'PRESCRIPTION_REVISED',
          oldValues: {
            prescriptionId: therapy.currentPrescription.id,
            versionId: therapy.currentPrescription.versionId,
          },
          newValues: {
            prescriptionId: snapshot.id,
            versionId: version.id,
            reason: dto.reason,
            pendingDoseId: dose.id,
            pendingStepId: pendingStep.id,
            historicalDosesUnchanged: true,
          },
          changedFields: ['currentPrescriptionId'],
        },
        tx,
      );
      return {
        dryRun: false,
        prescriptionId: snapshot.id,
        previousPrescriptionId: therapy.currentPrescription.id,
        pendingDose: updatedDose,
        therapyRevision: updatedTherapy.revision,
      };
    });
  }
}
