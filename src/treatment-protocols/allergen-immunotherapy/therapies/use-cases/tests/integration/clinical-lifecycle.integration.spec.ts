import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { syntheticProtocolDefinition } from 'test/fixtures/configured-protocol';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ProtocolCatalogService } from '../../../../protocol-catalog/protocol-catalog.service';
import { ConfiguredDoseService } from '../../../../dosing/configured-dose.service';
import { DoseCorrectionService } from '../../../../dosing/dose-correction.service';
import { CreateImmunotherapyUseCase } from '../../create-immunotherapy.use-case';
import { TherapyLifecycleService } from '../../../therapy-lifecycle.service';
import { PrescriptionRevisionService } from '../../../prescription-revision.service';
import { AppointmentsService } from 'src/scheduling/appointments.service';
import type { CreateImmunotherapyDto } from '../../../dtos/create-immunotherapy.dto';

describe('Clinical lifecycle workflows - Integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let catalog: ProtocolCatalogService;
  let clinical: ConfiguredDoseService;
  let lifecycle: TherapyLifecycleService;
  let revision: PrescriptionRevisionService;
  let correction: DoseCorrectionService;
  let appointments: AppointmentsService;
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
    lifecycle = module.get(TherapyLifecycleService);
    revision = module.get(PrescriptionRevisionService);
    correction = module.get(DoseCorrectionService);
    appointments = module.get(AppointmentsService);
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
      idempotencyKey: `lifecycle-${sequence}`,
      patient: {
        fullName: `Paciente ${sequence}`,
        birthDate: new Date('1990-01-01'),
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
  async function administer(
    doseId: string,
    overrides: Record<string, unknown> = {},
  ) {
    sequence += 1;
    const detail = (await clinical.read(doseId, physician)) as {
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
        administeredAt: '2026-01-01T13:00:00Z',
        expectedRevision: detail.revision,
        expectedTherapyRevision: detail.therapyRevision,
        idempotencyKey: `lifecycle-cmd-${sequence}`,
        betweenDosesReport: '',
        ...overrides,
      } as never,
      physician,
    )) as { dose: { id: string }; successor: { id: string } | null };
  }

  it('suspends and resumes with reason, authorship, return forecast and readable history', async () => {
    const result = await create.execute(createInput(), physician);
    const therapyId = result.immunotherapy.id;

    const suspended = await lifecycle.execute(
      therapyId,
      {
        action: 'SUSPEND',
        expectedRevision: 0,
        reason: 'Reação adversa extensa na última aplicação.',
        category: 'severe_adverse_reaction',
        expectedReturnAt: '2026-02-01T12:00:00-03:00',
      },
      physician,
    );
    expect(suspended.status).toBe('SUSPENDED');
    expect(suspended.event.expectedReturnAt?.toISOString()).toBe(
      '2026-02-01T15:00:00.000Z',
    );

    // Comandos clínicos bloqueados enquanto suspenso.
    await expect(administer(result.firstDose.id)).rejects.toThrow(
      'TREATMENT_NOT_ACTIVE',
    );
    // Previsão pendente preservada.
    const pending = await prisma.dose.findUniqueOrThrow({
      where: { id: result.firstDose.id },
    });
    expect(pending.status).toBe('SCHEDULED');
    expect(pending.isArchived).toBe(false);

    await lifecycle.execute(
      therapyId,
      {
        action: 'RESUME',
        expectedRevision: suspended.revision,
        reason: 'Paciente reavaliado e apto.',
      },
      physician,
    );
    const history = await lifecycle.history(therapyId, physician);
    expect(history.therapy.status).toBe('IN_PROGRESS');
    expect(history.events.map((event) => event.type)).toEqual([
      'RESUMPTION',
      'SUSPENSION',
    ]);
    expect(history.events[1].category).toBe('severe_adverse_reaction');
    expect(history.events[1].createdBy.professional?.fullName).toBeDefined();
  });

  it('enforces authorization, stale revision and valid transitions', async () => {
    const nurse = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['NURSE'],
    );
    const result = await create.execute(createInput(), physician);
    const therapyId = result.immunotherapy.id;
    await expect(
      lifecycle.execute(
        therapyId,
        { action: 'SUSPEND', expectedRevision: 0, reason: 'x' },
        nurse,
      ),
    ).rejects.toThrow(NotFoundException);
    await expect(
      lifecycle.execute(
        therapyId,
        { action: 'SUSPEND', expectedRevision: 5, reason: 'x' },
        physician,
      ),
    ).rejects.toThrow('STALE_CLINICAL_REVISION');
    await expect(
      lifecycle.execute(
        therapyId,
        { action: 'RESUME', expectedRevision: 0, reason: 'x' },
        physician,
      ),
    ).rejects.toThrow('INVALID_LIFECYCLE_TRANSITION');
    expect(await prisma.therapyLifecycleEvent.count()).toBe(0);
  });

  it('completes with structured recommendations and archives the pending forecast explicitly', async () => {
    const result = await create.execute(createInput(), physician);
    const therapyId = result.immunotherapy.id;
    const completed = await lifecycle.execute(
      therapyId,
      {
        action: 'COMPLETE',
        expectedRevision: 0,
        reason: 'Meta terapêutica atingida e sustentada.',
        recommendations: {
          retesting: true,
          rescueMedication: false,
          environmentalControl: true,
          custom: ['Retorno em 6 meses'],
          monitoringSchedule: 'Semestral no primeiro ano.',
          warningSigns: 'Recorrência de sintomas respiratórios.',
        },
      },
      physician,
    );
    expect(completed.status).toBe('COMPLETED');
    expect(completed.archivedDoseIds).toEqual([result.firstDose.id]);
    const archived = await prisma.dose.findUniqueOrThrow({
      where: { id: result.firstDose.id },
    });
    expect(archived.isArchived).toBe(true);
    expect(archived.archivedById).toBe(physician.id);
    const history = await lifecycle.history(therapyId, physician);
    expect(history.events[0].recommendations).toMatchObject({
      retesting: true,
      custom: ['Retorno em 6 meses'],
    });
    // Recomendações fora do encerramento são rejeitadas.
    await expect(
      lifecycle.execute(
        therapyId,
        {
          action: 'SUSPEND',
          expectedRevision: completed.revision,
          reason: 'x',
          recommendations: { retesting: true },
        },
        physician,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('revises the prescription to a new published version with a new snapshot and preserved history', async () => {
    const result = await create.execute(createInput(), physician);
    const therapyId = result.immunotherapy.id;
    const administered = await administer(result.firstDose.id);
    const historicalDose = await prisma.dose.findUniqueOrThrow({
      where: { id: result.firstDose.id },
    });

    // v2 publicada com os mesmos passos (rótulos revisados).
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

    const therapy = await prisma.immunotherapy.findUniqueOrThrow({
      where: { id: therapyId },
    });
    const prescriptionInput = {
      protocolId,
      protocolVersionId: draft.id,
      route: 'SUBCUTANEOUS',
      stepIds: ['low', 'middle', 'high'],
      startingStepId: 'low',
      targetStepId: 'high',
    };

    const rehearsal = (await revision.revise(
      therapyId,
      {
        targetVersionId: draft.id,
        prescription: prescriptionInput,
        pendingStepId: 'middle',
        reason: 'Migrar para a revisão clínica v2.',
        expectedRevision: therapy.revision,
        dryRun: true,
      },
      physician,
    )) as { dryRun: boolean; pendingDoseId: string };
    expect(rehearsal.dryRun).toBe(true);
    expect(await prisma.protocolPrescription.count()).toBe(1);

    const committed = (await revision.revise(
      therapyId,
      {
        targetVersionId: draft.id,
        prescription: prescriptionInput,
        pendingStepId: 'middle',
        reason: 'Migrar para a revisão clínica v2.',
        expectedRevision: therapy.revision,
        dryRun: false,
      },
      physician,
    )) as { prescriptionId: string; previousPrescriptionId: string };

    // Snapshot novo vigente; o anterior permanece imutável e referenciado.
    expect(await prisma.protocolPrescription.count()).toBe(2);
    const current = await prisma.immunotherapy.findUniqueOrThrow({
      where: { id: therapyId },
      include: { currentPrescription: true },
    });
    expect(current.currentPrescription!.id).toBe(committed.prescriptionId);
    expect(current.currentPrescription!.versionId).toBe(draft.id);
    expect(current.currentPrescription!.revisionReason).toContain('v2');

    // Dose administrada intocada, ainda apontando o snapshot antigo.
    const untouched = await prisma.dose.findUniqueOrThrow({
      where: { id: result.firstDose.id },
    });
    expect(untouched).toEqual(historicalDose);
    expect(untouched.prescriptionId).toBe(committed.previousPrescriptionId);

    // Pendente reancorada na v2 sem mudar a data prevista.
    const pending = await prisma.dose.findUniqueOrThrow({
      where: { id: administered.successor!.id },
    });
    expect(pending.prescriptionId).toBe(committed.prescriptionId);
    expect(pending.plannedStepId).toBe('middle');
    expect(pending.scheduledAt.toISOString()).toBe(
      (await prisma.auditLog.findFirst({
        where: { action: 'PRESCRIPTION_REVISED' },
      }))
        ? pending.scheduledAt.toISOString()
        : 'unreachable',
    );

    // Administrar a pendente agora recomenda pela v2.
    const applied = await administer(pending.id, {
      administeredAt: '2026-01-08T13:00:00Z',
    });
    expect(applied.successor).not.toBeNull();
    const recommendation = (
      await prisma.dose.findUniqueOrThrow({ where: { id: pending.id } })
    ).recommendation as { protocolVersionId: string };
    expect(recommendation.protocolVersionId).toBe(draft.id);

    // Mesma versão de destino é rejeitada.
    const after = await prisma.immunotherapy.findUniqueOrThrow({
      where: { id: therapyId },
    });
    await expect(
      revision.revise(
        therapyId,
        {
          targetVersionId: draft.id,
          prescription: prescriptionInput,
          pendingStepId: 'middle',
          reason: 'de novo',
          expectedRevision: after.revision,
          dryRun: true,
        },
        physician,
      ),
    ).rejects.toThrow('REVISION_TARGETS_SAME_VERSION');
  });

  it('retracts an administered dose, archiving its successor and reissuing the original forecast', async () => {
    const result = await create.execute(createInput(), physician);
    const administered = await administer(result.firstDose.id);
    const doseBefore = await prisma.dose.findUniqueOrThrow({
      where: { id: result.firstDose.id },
    });

    const therapy = await prisma.immunotherapy.findUniqueOrThrow({
      where: { id: result.immunotherapy.id },
    });
    const retracted = await correction.retract(
      result.firstDose.id,
      {
        reason: 'Registro lançado no paciente errado.',
        expectedRevision: doseBefore.revision,
        expectedTherapyRevision: therapy.revision,
      },
      physician,
    );
    expect(retracted.dose.status).toBe('ENTERED_IN_ERROR');
    // Valores administrados preservados — nada foi apagado.
    expect(retracted.dose.administeredValues).toEqual(
      doseBefore.administeredValues,
    );
    expect(retracted.archivedSuccessorId).toBe(administered.successor!.id);
    const successor = await prisma.dose.findUniqueOrThrow({
      where: { id: administered.successor!.id },
    });
    expect(successor.isArchived).toBe(true);
    // Previsão original reemitida como estava.
    expect(retracted.reissuedDose.status).toBe('SCHEDULED');
    expect(retracted.reissuedDose.plannedStepId).toBe(doseBefore.plannedStepId);
    expect(retracted.reissuedDose.scheduledAt).toEqual(doseBefore.scheduledAt);
    expect(
      await prisma.auditLog.count({ where: { action: 'DOSE_RETRACTED' } }),
    ).toBe(1);
  });

  it('requires explicit analysis when the successor was already administered', async () => {
    const result = await create.execute(createInput(), physician);
    const administered = await administer(result.firstDose.id);
    await administer(administered.successor!.id, {
      administeredAt: '2026-01-08T13:00:00Z',
    });
    const dose = await prisma.dose.findUniqueOrThrow({
      where: { id: result.firstDose.id },
    });
    const therapy = await prisma.immunotherapy.findUniqueOrThrow({
      where: { id: result.immunotherapy.id },
    });
    await expect(
      correction.retract(
        result.firstDose.id,
        {
          reason: 'x',
          expectedRevision: dose.revision,
          expectedTherapyRevision: therapy.revision,
        },
        physician,
      ),
    ).rejects.toThrow('SUCCESSOR_ALREADY_ADMINISTERED');
    expect(
      (await prisma.dose.findUniqueOrThrow({ where: { id: dose.id } })).status,
    ).toBe(dose.status);
  });

  it('records late observations with own authorship and composes suspension atomically', async () => {
    const nurse = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['NURSE'],
    );
    const result = await create.execute(createInput(), physician);
    await administer(result.firstDose.id);

    // Antes da administração é inválido.
    const therapy = await prisma.immunotherapy.findUniqueOrThrow({
      where: { id: result.immunotherapy.id },
    });
    await expect(
      correction.addLateObservation(
        result.firstDose.id,
        {
          reportedSideEffects: [],
          administeredMedications: [],
          observedAt: '2025-12-31T13:00:00Z',
          expectedTherapyRevision: therapy.revision,
        },
        physician,
      ),
    ).rejects.toThrow('INVALID_OBSERVATION_TIME');

    // Enfermagem registra a observação tardia, mas não suspende.
    await expect(
      correction.addLateObservation(
        result.firstDose.id,
        {
          reportedSideEffects: ['Urticária generalizada'],
          administeredMedications: ['Anti-histamínico'],
          observedAt: '2026-01-01T20:00:00Z',
          conduct: {
            type: 'SUSPEND_TREATMENT',
            justification: 'Reação tardia intensa.',
          },
          expectedTherapyRevision: therapy.revision,
        },
        nurse,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(await prisma.doseObservationAddendum.count()).toBe(0);

    const composed = await correction.addLateObservation(
      result.firstDose.id,
      {
        reportedSideEffects: ['Urticária generalizada'],
        administeredMedications: ['Anti-histamínico'],
        notes: 'Paciente relatou por telefone à noite.',
        observedAt: '2026-01-01T20:00:00Z',
        conduct: {
          type: 'SUSPEND_TREATMENT',
          justification: 'Reação tardia intensa: suspender até reavaliação.',
        },
        expectedTherapyRevision: therapy.revision,
      },
      physician,
    );
    expect(composed.suspensionEventId).not.toBeNull();
    const updatedTherapy = await prisma.immunotherapy.findUniqueOrThrow({
      where: { id: result.immunotherapy.id },
    });
    expect(updatedTherapy.status).toBe('SUSPENDED');
    const addendum = await prisma.doseObservationAddendum.findUniqueOrThrow({
      where: { id: composed.addendum.id },
    });
    expect(addendum.createdById).toBe(physician.id);
    expect(addendum.observedAt.toISOString()).toBe('2026-01-01T20:00:00.000Z');
    // As observações originais da administração permanecem intactas (registro
    // adicional, não reescrita).
    expect(
      await prisma.doseObservation.count({
        where: { doseId: result.firstDose.id },
      }),
    ).toBe(0);
  });

  it('manages appointments as their own entity, distinct from the clinical dose', async () => {
    const receptionist = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['RECEPTIONIST'],
    );
    const result = await create.execute(createInput(), physician);
    const patientId = result.patient.id;

    const created = await appointments.create(
      {
        patientId,
        doseId: result.firstDose.id,
        title: 'Aplicação SCIT',
        startsAt: '2026-01-01T10:00:00-03:00',
        endsAt: '2026-01-01T10:30:00-03:00',
      },
      receptionist,
    );
    expect(created.dose?.id).toBe(result.firstDose.id);

    // Vínculo é único por dose.
    await expect(
      appointments.create(
        {
          patientId,
          doseId: result.firstDose.id,
          startsAt: '2026-01-02T10:00:00-03:00',
          endsAt: '2026-01-02T10:30:00-03:00',
        },
        receptionist,
      ),
    ).rejects.toThrow('DOSE_ALREADY_SCHEDULED');

    // Cancelamento exige motivo.
    await expect(
      appointments.update(
        created.id,
        { expectedRevision: created.revision, status: 'CANCELLED' },
        receptionist,
      ),
    ).rejects.toThrow('STATUS_REASON_REQUIRED');

    // Falta registrada após o horário não altera a dose clínica.
    const missed = await appointments.update(
      created.id,
      {
        expectedRevision: created.revision,
        status: 'MISSED',
        statusReason: 'Paciente não compareceu nem avisou.',
      },
      receptionist,
    );
    expect(missed.status).toBe('MISSED');
    expect(
      (
        await prisma.dose.findUniqueOrThrow({
          where: { id: result.firstDose.id },
        })
      ).status,
    ).toBe('SCHEDULED');

    // Compromisso encerrado não reagenda; revisão stale conflita.
    await expect(
      appointments.update(
        created.id,
        {
          expectedRevision: missed.revision,
          startsAt: '2026-01-05T10:00:00-03:00',
          endsAt: '2026-01-05T10:30:00-03:00',
        },
        receptionist,
      ),
    ).rejects.toThrow('APPOINTMENT_ALREADY_CLOSED');
    await expect(
      appointments.update(
        created.id,
        { expectedRevision: 0, status: 'CANCELLED', statusReason: 'x' },
        receptionist,
      ),
    ).rejects.toThrow('STALE_APPOINTMENT_REVISION');

    // Escopo por papel: outro médico não enxerga o compromisso.
    const outsiderPhysician = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['PHYSICIAN'],
    );
    const window = {
      from: '2026-01-01T00:00:00-03:00',
      to: '2026-01-07T23:59:59-03:00',
    };
    expect((await appointments.list(window, physician)).total).toBe(1);
    expect((await appointments.list(window, outsiderPhysician)).total).toBe(0);
    expect((await appointments.list(window, receptionist)).total).toBe(1);
  });

  it('marks a miss only after the start time', async () => {
    const receptionist = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['RECEPTIONIST'],
    );
    const result = await create.execute(createInput(), physician);
    const future = new Date(Date.now() + 7 * 86_400_000);
    const end = new Date(future.getTime() + 1_800_000);
    const created = await appointments.create(
      {
        patientId: result.patient.id,
        startsAt: future.toISOString(),
        endsAt: end.toISOString(),
      },
      receptionist,
    );
    await expect(
      appointments.update(
        created.id,
        {
          expectedRevision: created.revision,
          status: 'MISSED',
          statusReason: 'x',
        },
        receptionist,
      ),
    ).rejects.toThrow('MISS_BEFORE_START');
  });
});
