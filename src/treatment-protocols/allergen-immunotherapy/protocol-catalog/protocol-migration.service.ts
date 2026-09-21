import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
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
} from './protocol-catalog.service';
import { resolveProtocolStep } from '../clinical-rules/resolve-protocol-step';
import type { ResolvedPrescription } from '../clinical-rules/protocol-definition';

@Injectable()
export class ProtocolMigrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clinical: ConfiguredDoseService,
    private readonly audit: IAuditLogService,
  ) {}
  async inventory(user: AuthenticatedUserPayload) {
    requireClinicalAuthor(user);
    const therapies = await this.prisma.immunotherapy.findMany({
      where: { patient: { organizationId: user.organizationId } },
      include: {
        doses: true,
        currentPrescription: true,
        patient: { select: { id: true, fullName: true, isActive: true } },
      },
    });
    const stored = await this.prisma.$queryRaw<
      { id: string; volumeText: string }[]
    >`SELECT d.id, d.volume::text AS "volumeText" FROM "Dose" d JOIN "Immunotherapy" i ON i.id = d."immunotherapyId" JOIN "Patient" p ON p.id = i."patientId" WHERE p."organizationId" = ${user.organizationId}`;
    const targets = await this.prisma.$queryRaw<
      { id: string; volumeText: string }[]
    >`SELECT i.id, i."targetVolume"::text AS "volumeText" FROM "Immunotherapy" i JOIN "Patient" p ON p.id = i."patientId" WHERE p."organizationId" = ${user.organizationId}`;
    const exactTargets = new Map(
      targets.map((row) => [row.id, row.volumeText]),
    );
    const exactVolumes = new Map(stored.map((row) => [row.id, row.volumeText]));
    const values = new Map<
      string,
      { concentration: string; volume: string; intervalDays: number }
    >();
    const report = therapies.map((therapy) => {
      const pending = therapy.doses.filter(
        (dose) => dose.status === 'SCHEDULED' && !dose.isArchived,
      );
      const issues: string[] = [];
      if (therapy.administrationRoute !== 'SUBCUTANEOUS')
        issues.push('UNSUPPORTED_ROUTE');
      if (!therapy.currentPrescription) issues.push('PROTOCOL_NOT_BOUND');
      if (pending.length > 1) issues.push('MULTIPLE_PENDING_DOSES');
      if (!pending.length) issues.push('NO_PENDING_DOSE_REQUIRES_REVIEW');
      const decimals = therapy.doses.map((dose) => {
        const volume = exactVolumes.get(dose.id)!;
        const value = {
          concentration: String(dose.concentration),
          volume,
          intervalDays: dose.nextIntervalInDays,
        };
        const exact =
          /^\d+(\.\d+)?$/.test(volume) &&
          dose.volume > 0 &&
          volume.split('.')[0].length <= 35 &&
          (volume.split('.')[1]?.length ?? 0) <= 30 &&
          dose.concentration > 0 &&
          dose.nextIntervalInDays > 0;
        if (!exact) issues.push(`UNREPRESENTABLE_VALUE:${dose.id}`);
        else values.set(JSON.stringify(value), value);
        return {
          doseId: dose.id,
          storedVolumeText: volume,
          decimalText: volume,
          exactCandidate: exact,
          historicalRecordUnchanged: dose.status !== 'SCHEDULED',
        };
      });
      return {
        therapyId: therapy.id,
        revision: therapy.revision,
        prescriptionId: therapy.currentPrescription?.id ?? null,
        // Identificação mínima para a revisão assistida: quem é o registro.
        patient: therapy.patient,
        immunoType: therapy.immunoType,
        extract: therapy.extract,
        status: therapy.status,
        administrationRoute: therapy.administrationRoute,
        inductionStartDate: therapy.inductionStartDate,
        target: {
          concentration: String(therapy.targetConcentration),
          volume: exactTargets.get(therapy.id),
        },
        pendingDoses: pending.map((dose) => ({
          id: dose.id,
          scheduledAt: dose.scheduledAt,
          concentration: String(dose.concentration),
          volume: exactVolumes.get(dose.id)!,
          intervalDays: dose.nextIntervalInDays,
        })),
        pendingDoseIds: pending.map((dose) => dose.id),
        issues,
        decimals,
      };
    });
    const steps = [...values.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({
        ...value,
        id: `legacy-${createHash('sha256').update(key).digest('hex').slice(0, 20)}`,
        label: `Legacy ${value.concentration} / ${value.volume} mL / ${value.intervalDays} days`,
        phase: 'BUILD_UP',
        nextStepId: null,
      }));
    return {
      report,
      originDraft: {
        schemaVersion: 1,
        engineVersion: '1',
        route: 'SUBCUTANEOUS',
        volumeUnit: 'mL',
        concentrationUnit: 'DILUTION_DENOMINATOR',
        provenance: 'LEGACY_INVENTORY_NOT_CLINICALLY_APPROVED',
        requiresClinicalTransitionReview: true,
        steps,
      },
      dryRun: true,
    };
  }
  async createOriginDraft(user: AuthenticatedUserPayload) {
    const inventory = await this.inventory(user);
    // Creation is explicit; inventory never writes and no transition is inferred from counters.
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${user.organizationId} FOR NO KEY UPDATE`;
      const existing = await tx.treatmentProtocol.findFirst({
        where: {
          organizationId: user.organizationId,
          name: 'Legacy inventory (clinical review required)',
        },
        include: { versions: true },
      });
      if (existing) return existing;
      const protocol = await tx.treatmentProtocol.create({
        data: {
          organizationId: user.organizationId,
          name: 'Legacy inventory (clinical review required)',
          route: 'SUBCUTANEOUS',
          createdById: user.id,
        },
      });
      await tx.protocolVersion.create({
        data: {
          protocolId: protocol.id,
          organizationId: user.organizationId,
          number: 1,
          definition: json(inventory.originDraft),
          createdById: user.id,
        },
      });
      await this.audit.record(
        {
          userId: user.id,
          organizationId: user.organizationId,
          entityType: 'TreatmentProtocol',
          entityId: protocol.id,
          action: 'PROTOCOL_DRAFT_CREATED',
          newValues: { provenance: 'LEGACY_INVENTORY_NOT_CLINICALLY_APPROVED' },
        },
        tx,
      );
      // Mesmo shape do caminho idempotente: o cliente sempre recebe as versões.
      return tx.treatmentProtocol.findUniqueOrThrow({
        where: { id: protocol.id },
        include: { versions: true },
      });
    });
  }
  async bind(
    id: string,
    versionId: string,
    resolvedInput: ResolvedPrescription,
    expectedRevision: number,
    user: AuthenticatedUserPayload,
    dryRun = true,
  ) {
    requireClinicalAuthor(user);
    return this.prisma.$transaction(async (tx) => {
      const therapy = await this.clinical.lockTherapy(tx, id, user);
      if (therapy.currentPrescription) {
        if (
          therapy.currentPrescription.versionId !== versionId ||
          !isDeepStrictEqual(
            therapy.currentPrescription.resolved,
            json({
              ...resolvedInput,
              timeZone: (
                therapy.currentPrescription.resolved as Record<string, unknown>
              ).timeZone,
            }),
          )
        )
          throw new ConflictException('PRESCRIPTION_ALREADY_BOUND');
        return {
          alreadyBound: true,
          prescriptionId: therapy.currentPrescription.id,
        };
      }
      if (therapy.revision !== expectedRevision)
        throw new ConflictException('STALE_CLINICAL_REVISION');
      if (therapy.administrationRoute !== 'SUBCUTANEOUS')
        throw new ConflictException('UNSUPPORTED_ROUTE');
      await tx.$queryRaw`SELECT id FROM "ProtocolVersion" WHERE id = ${versionId} AND "organizationId" = ${user.organizationId} FOR SHARE`;
      const version = await tx.protocolVersion.findFirst({
        where: {
          id: versionId,
          organizationId: user.organizationId,
          status: 'PUBLISHED',
        },
      });
      if (!version) throw new NotFoundException();
      const protocol = persistenceDefinition(version);
      const resolved = prescriptionFromJson(resolvedInput, protocol);
      const historicalTarget = await tx.$queryRaw<
        { volumeText: string }[]
      >`SELECT "targetVolume"::text AS "volumeText" FROM "Immunotherapy" WHERE id = ${id}`;
      const target = protocol.steps.find(
        (step) => step.id === resolved.targetStepId,
      )!;
      if (
        new Prisma.Decimal(target.volume).comparedTo(
          historicalTarget[0].volumeText,
        ) !== 0 ||
        target.concentration !== String(therapy.targetConcentration)
      )
        throw new ConflictException('LEGACY_TARGET_MISMATCH');
      const doses = await tx.dose.findMany({
        where: { immunotherapyId: id, status: 'SCHEDULED', isArchived: false },
      });
      if (doses.length !== 1)
        throw new ConflictException('PENDING_DOSE_REQUIRES_REVIEW');
      const dose = doses[0];
      const historicalDose = await tx.$queryRaw<
        { volumeText: string }[]
      >`SELECT volume::text AS "volumeText" FROM "Dose" WHERE id = ${dose.id}`;
      const resolution = resolveProtocolStep({
        protocol,
        prescription: resolved,
        administered: {
          concentration: String(dose.concentration),
          volume: historicalDose[0].volumeText,
          intervalDays: dose.nextIntervalInDays,
          route: protocol.route,
          volumeUnit: protocol.volumeUnit,
          concentrationUnit: protocol.concentrationUnit,
        },
      });
      if (resolution.kind === 'UNRESOLVED')
        throw new BadRequestException(resolution);
      if (dryRun)
        return {
          dryRun: true,
          therapyId: id,
          doseId: dose.id,
          stepId: resolution.step.id,
          historicalDosesUnchanged: true,
        };
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: user.organizationId },
      });
      const snapshot = await tx.protocolPrescription.create({
        data: {
          immunotherapyId: id,
          organizationId: user.organizationId,
          versionId,
          resolved: json({ ...resolved, timeZone: organization.timeZone }),
          createdById: user.id,
        },
      });
      await tx.dose.update({
        where: { id: dose.id },
        data: {
          prescriptionId: snapshot.id,
          plannedStepId: resolution.step.id,
          plannedValues: json(configuredValues(resolution.step, protocol)),
          plannedVolumeExact: new Prisma.Decimal(resolution.step.volume),
          revision: { increment: 1 },
          updatedById: user.id,
        },
      });
      await tx.immunotherapy.update({
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
          action: 'PROTOCOL_BACKFILLED',
          newValues: {
            prescriptionId: snapshot.id,
            versionId,
            pendingDoseId: dose.id,
            historicalDosesUnchanged: true,
          },
        },
        tx,
      );
      return { prescriptionId: snapshot.id, alreadyBound: false };
    });
  }
}
