import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { syntheticProtocolDefinition } from 'test/fixtures/configured-protocol';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ProtocolCatalogService } from '../../../../protocol-catalog/protocol-catalog.service';
import { ConfiguredDoseService } from '../../../configured-dose.service';
import { DoseCorrectionService } from '../../../dose-correction.service';
import { CreateImmunotherapyUseCase } from '../../../../therapies/use-cases/create-immunotherapy.use-case';
import { TherapyLifecycleService } from '../../../../therapies/therapy-lifecycle.service';
import { PrescriptionRevisionService } from '../../../../therapies/prescription-revision.service';
import type { CreateImmunotherapyDto } from '../../../../therapies/dtos/create-immunotherapy.dto';

describe('Clinical command idempotency and recomputation - Integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let catalog: ProtocolCatalogService;
  let clinical: ConfiguredDoseService;
  let correction: DoseCorrectionService;
  let lifecycle: TherapyLifecycleService;
  let revision: PrescriptionRevisionService;
  let create: CreateImmunotherapyUseCase;
  let factories: TestFactories;
  let physician: AuthenticatedUserPayload;
  let versionId: string;
  let protocolId: string;

  beforeAll(async () => {
    await TestDatabaseManager.connect();
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();
    prisma = module.get(PrismaService);
    catalog = module.get(ProtocolCatalogService);
    clinical = module.get(ConfiguredDoseService);
    correction = module.get(DoseCorrectionService);
    lifecycle = module.get(TherapyLifecycleService);
    revision = module.get(PrescriptionRevisionService);
    create = module.get(CreateImmunotherapyUseCase);
    factories = new TestFactories(prisma);
  });
  afterAll(async () => {
    await module.close();
    await TestDatabaseManager.disconnect();
  });
  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();
    physician =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const created = await catalog.create(
      {
        name: 'Synthetic test protocol',
        definition: syntheticProtocolDefinition(),
      },
      physician,
    );
    versionId = created.version.id;
    protocolId = created.protocol.id;
    await catalog.mutate(versionId, 0, physician, 'publish');
    await catalog.mutate(versionId, 1, physician, 'default');
    await catalog.settings(
      { enabled: true, timeZone: 'America/Sao_Paulo' },
      physician,
    );
  });

  let sequence = 0;
  function createInput(): CreateImmunotherapyDto {
    sequence += 1;
    return {
      idempotencyKey: `command-${sequence}`,
      patient: {
        fullName: `Paciente ${sequence}`,
        birthDate: '1990-01-01',
        weightInKg: 70,
        phoneNumber: '11999999999',
        responsiblePhysicianId: physician.professionalId!,
      },
      immunoType: 'Synthetic',
      administrationRoute: 'SUBCUTANEOUS',
      extract: 'Synthetic extract',
      inductionStartDate: '2026-01-01T13:00:00Z',
      stepIds: ['low', 'middle', 'high'],
      startingStepId: 'low',
      targetStepId: 'high',
    };
  }
  async function administer(doseId: string, administeredAt: string) {
    sequence += 1;
    const detail = (await clinical.read(doseId, physician)) as unknown as {
      revision: number;
      therapyRevision: number;
      plannedStepId: string;
      plannedValues: {
        concentration: string;
        volume: string;
        intervalDays: number;
      };
    };
    return (await clinical.administer(
      doseId,
      {
        values: {
          concentration: detail.plannedValues.concentration,
          volume: detail.plannedValues.volume,
          intervalDays: detail.plannedValues.intervalDays,
          stepId: detail.plannedStepId,
        },
        administeredAt,
        expectedRevision: detail.revision,
        expectedTherapyRevision: detail.therapyRevision,
        idempotencyKey: `command-cmd-${sequence}`,
        betweenDosesReport: '',
      },
      physician,
    )) as { dose: { id: string }; successor: { id: string } | null };
  }
  async function revisions(doseId: string) {
    const dose = await prisma.dose.findUniqueOrThrow({
      where: { id: doseId },
      include: { immunotherapy: true },
    });
    return {
      expectedRevision: dose.revision,
      expectedTherapyRevision: dose.immunotherapy.revision,
    };
  }

  it('replays a retraction with the same key and rejects the key with another payload', async () => {
    const result = await create.execute(createInput(), physician);
    await administer(result.firstDose.id, '2026-01-01T13:00:00Z');
    const dto = {
      reason: 'Registro lançado no paciente errado.',
      ...(await revisions(result.firstDose.id)),
      idempotencyKey: 'retract-1',
    };
    const first = await correction.retract(result.firstDose.id, dto, physician);
    const replay = await correction.retract(
      result.firstDose.id,
      { ...dto },
      physician,
    );
    expect(replay).toEqual(first);
    expect(await prisma.dose.count()).toBe(3);
    expect(
      await prisma.dose.count({ where: { status: 'ENTERED_IN_ERROR' } }),
    ).toBe(1);
    expect(await prisma.clinicalCommand.count()).toBe(2);
    await expect(
      correction.retract(
        result.firstDose.id,
        { ...dto, reason: 'Outro motivo' },
        physician,
      ),
    ).rejects.toThrow('IDEMPOTENCY_KEY_REUSED');
  });

  it('replays a late observation without duplicating addendum or outbox event', async () => {
    const result = await create.execute(createInput(), physician);
    await administer(result.firstDose.id, '2026-01-01T13:00:00Z');
    const { expectedTherapyRevision } = await revisions(result.firstDose.id);
    const dto = {
      reportedSideEffects: ['Urticária generalizada'],
      administeredMedications: ['Anti-histamínico'],
      observedAt: '2026-01-01T20:00:00Z',
      conduct: {
        type: 'REQUEST_PHYSICIAN_REVIEW' as const,
        justification: 'Reação tardia; reavaliar prescrição.',
      },
      expectedTherapyRevision,
      idempotencyKey: 'observation-1',
    };
    const first = await correction.addLateObservation(
      result.firstDose.id,
      dto,
      physician,
    );
    const replay = await correction.addLateObservation(
      result.firstDose.id,
      { ...dto },
      physician,
    );
    expect(replay).toEqual(first);
    expect(await prisma.doseObservationAddendum.count()).toBe(1);
    expect(await prisma.outboxEvent.count()).toBe(1);
    await expect(
      correction.addLateObservation(
        result.firstDose.id,
        { ...dto, notes: 'Relato complementar' },
        physician,
      ),
    ).rejects.toThrow('IDEMPOTENCY_KEY_REUSED');
    expect(await prisma.doseObservationAddendum.count()).toBe(1);
  });

  it('validates the therapy revision on late observations even without conduct', async () => {
    const result = await create.execute(createInput(), physician);
    await administer(result.firstDose.id, '2026-01-01T13:00:00Z');
    await expect(
      correction.addLateObservation(
        result.firstDose.id,
        {
          reportedSideEffects: ['Prurido local'],
          administeredMedications: [],
          observedAt: '2026-01-01T20:00:00Z',
          expectedTherapyRevision: 0,
        },
        physician,
      ),
    ).rejects.toThrow('STALE_CLINICAL_REVISION');
    expect(await prisma.doseObservationAddendum.count()).toBe(0);
  });

  it('replays a scheduled dose edit without incrementing revisions again', async () => {
    const result = await create.execute(createInput(), physician);
    const dto = {
      values: {
        concentration: '1000',
        volume: '0.2',
        intervalDays: 7,
        stepId: 'middle',
      },
      scheduledAt: '2026-01-02T13:00:00Z',
      reason: 'Ajuste clínico',
      expectedRevision: 0,
      expectedTherapyRevision: 0,
      idempotencyKey: 'edit-1',
    };
    const first = await clinical.edit(result.firstDose.id, dto, physician);
    const replay = await clinical.edit(
      result.firstDose.id,
      { ...dto },
      physician,
    );
    expect(replay).toEqual(first);
    expect(
      await prisma.dose.findUniqueOrThrow({
        where: { id: result.firstDose.id },
      }),
    ).toMatchObject({ revision: 1, plannedStepId: 'middle' });
    await expect(
      clinical.edit(
        result.firstDose.id,
        { ...dto, scheduledAt: '2026-01-03T13:00:00Z' },
        physician,
      ),
    ).rejects.toThrow('IDEMPOTENCY_KEY_REUSED');
  });

  it('replays a lifecycle command keeping a single event and revision', async () => {
    const result = await create.execute(createInput(), physician);
    const therapyId = result.immunotherapy.id;
    const dto = {
      action: 'SUSPEND' as const,
      expectedRevision: 0,
      reason: 'Reação adversa extensa.',
      idempotencyKey: 'lifecycle-1',
    };
    const first = await lifecycle.execute(therapyId, dto, physician);
    const replay = await lifecycle.execute(therapyId, { ...dto }, physician);
    expect(replay).toEqual(first);
    expect(await prisma.therapyLifecycleEvent.count()).toBe(1);
    expect(
      await prisma.immunotherapy.findUniqueOrThrow({
        where: { id: therapyId },
      }),
    ).toMatchObject({ status: 'SUSPENDED', revision: 1 });
    await expect(
      lifecycle.execute(
        therapyId,
        {
          action: 'RESUME',
          expectedRevision: 1,
          reason: 'Paciente apto.',
          idempotencyKey: 'lifecycle-1',
        },
        physician,
      ),
    ).rejects.toThrow('IDEMPOTENCY_KEY_REUSED');
    const resumed = await lifecycle.execute(
      therapyId,
      {
        action: 'RESUME',
        expectedRevision: 1,
        reason: 'Paciente apto.',
        idempotencyKey: 'lifecycle-2',
      },
      physician,
    );
    expect(resumed.status).toBe('IN_PROGRESS');
  });

  it('replays a committed prescription revision and never stores dry-runs', async () => {
    const result = await create.execute(createInput(), physician);
    const therapyId = result.immunotherapy.id;
    const definition = syntheticProtocolDefinition();
    definition.steps = definition.steps.map((step) => ({
      ...step,
      label: `${step.label} v2`,
    }));
    const draft = await catalog.createVersion(
      protocolId,
      definition,
      physician,
    );
    await catalog.mutate(draft.id, 0, physician, 'publish');
    const prescriptionInput = {
      protocolId,
      protocolVersionId: draft.id,
      route: 'SUBCUTANEOUS',
      stepIds: ['low', 'middle', 'high'],
      startingStepId: 'low',
      targetStepId: 'high',
    };
    const base = {
      targetVersionId: draft.id,
      prescription: prescriptionInput,
      pendingStepId: 'low',
      reason: 'Migrar para a revisão clínica v2.',
      expectedRevision: 0,
    };
    await revision.revise(
      therapyId,
      { ...base, dryRun: true, idempotencyKey: 'revision-dry' },
      physician,
    );
    expect(await prisma.clinicalCommand.count()).toBe(0);

    const dto = { ...base, dryRun: false, idempotencyKey: 'revision-1' };
    const first = await revision.revise(therapyId, dto, physician);
    const replay = await revision.revise(therapyId, { ...dto }, physician);
    expect(replay).toEqual(first);
    expect(await prisma.protocolPrescription.count()).toBe(2);
    expect(await prisma.clinicalCommand.count()).toBe(1);
    await expect(
      revision.revise(
        therapyId,
        { ...dto, reason: 'Outra justificativa' },
        physician,
      ),
    ).rejects.toThrow('IDEMPOTENCY_KEY_REUSED');
  });

  it('accepts repeating the previous step and recomputes the recommendation from it', async () => {
    const result = await create.execute(createInput(), physician);
    const applied = await administer(
      result.firstDose.id,
      '2026-01-01T13:00:00Z',
    );
    const pendingId = applied.successor!.id;
    expect(
      await prisma.dose.findUniqueOrThrow({ where: { id: pendingId } }),
    ).toMatchObject({ plannedStepId: 'middle' });
    const { expectedRevision, expectedTherapyRevision } =
      await revisions(pendingId);
    await clinical.edit(
      pendingId,
      {
        values: {
          concentration: '1000',
          volume: '0.1',
          intervalDays: 7,
          stepId: 'low',
        },
        scheduledAt: '2026-01-08T13:00:00Z',
        reason: 'Repetir a dose anterior por decisão clínica.',
        expectedRevision,
        expectedTherapyRevision,
      },
      physician,
    );
    const repeated = await administer(pendingId, '2026-01-08T13:00:00Z');
    expect(
      await prisma.dose.findUniqueOrThrow({ where: { id: pendingId } }),
    ).toMatchObject({ administeredStepId: 'low' });
    expect(
      await prisma.dose.findUniqueOrThrow({
        where: { id: repeated.successor!.id },
      }),
    ).toMatchObject({ plannedStepId: 'middle' });
  });

  it('allows the configured maintenance loop and recomputes milestones after retraction', async () => {
    const result = await create.execute(createInput(), physician);
    const first = await administer(result.firstDose.id, '2026-01-01T13:00:00Z');
    const second = await administer(
      first.successor!.id,
      '2026-01-08T13:00:00Z',
    );
    const maintenanceDoseId = second.successor!.id;
    const third = await administer(maintenanceDoseId, '2026-01-15T13:00:00Z');
    expect(
      await prisma.dose.findUniqueOrThrow({
        where: { id: third.successor!.id },
      }),
    ).toMatchObject({ plannedStepId: 'high' });
    const beforeRetraction = await prisma.immunotherapy.findUniqueOrThrow({
      where: { id: result.immunotherapy.id },
    });
    expect(beforeRetraction.maintenanceStartDate?.toISOString()).toBe(
      '2026-01-15T13:00:00.000Z',
    );
    const retracted = await correction.retract(
      maintenanceDoseId,
      {
        reason: 'Aplicação registrada em duplicidade.',
        ...(await revisions(maintenanceDoseId)),
        idempotencyKey: 'retract-maintenance',
      },
      physician,
    );
    const afterRetraction = await prisma.immunotherapy.findUniqueOrThrow({
      where: { id: result.immunotherapy.id },
    });
    expect(afterRetraction.maintenanceStartDate).toBeNull();
    expect(retracted.archivedSuccessorId).toBe(third.successor!.id);
    expect(
      await prisma.dose.findUniqueOrThrow({
        where: { id: third.successor!.id },
      }),
    ).toMatchObject({ isArchived: true });
    expect(retracted.reissuedDose).toMatchObject({
      plannedStepId: 'high',
      status: 'SCHEDULED',
    });
  });

  it('rejects publishing a BUILD_UP cycle without maintenance, naming the step', async () => {
    const definition = syntheticProtocolDefinition();
    definition.steps[1].nextStepId = 'low';
    const created = await catalog.create(
      { name: 'Cyclic build-up', definition },
      physician,
    );
    let caught: unknown;
    try {
      await catalog.mutate(created.version.id, 0, physician, 'publish');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    const response = (caught as BadRequestException).getResponse() as {
      code: string;
      detail: string;
    };
    expect(response.code).toBe('INVALID_PROTOCOL');
    expect(response.detail).toContain('BUILD_UP_WITHOUT_MAINTENANCE_PATH');
    expect(response.detail).toContain('"low"');
    expect(
      await prisma.protocolVersion.findUniqueOrThrow({
        where: { id: created.version.id },
      }),
    ).toMatchObject({ status: 'DRAFT' });
  });
});
