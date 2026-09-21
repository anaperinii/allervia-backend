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
import { ClinicalScheduleService } from '../../../clinical-schedule.service';
import { CreateImmunotherapyUseCase } from '../../../../therapies/use-cases/create-immunotherapy.use-case';
import type { CreateImmunotherapyDto } from '../../../../therapies/dtos/create-immunotherapy.dto';

describe('Clinical schedule and metrics - Integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let catalog: ProtocolCatalogService;
  let clinical: ConfiguredDoseService;
  let schedule: ClinicalScheduleService;
  let create: CreateImmunotherapyUseCase;
  let factories: TestFactories;
  let physician: AuthenticatedUserPayload;
  let versionId: string;

  beforeAll(async () => {
    await TestDatabaseManager.connect();
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();
    prisma = module.get(PrismaService);
    catalog = module.get(ProtocolCatalogService);
    clinical = module.get(ConfiguredDoseService);
    schedule = module.get(ClinicalScheduleService);
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
    await catalog.mutate(versionId, 0, physician, 'publish');
    await catalog.mutate(versionId, 1, physician, 'default');
    await catalog.settings(
      { enabled: true, timeZone: 'America/Sao_Paulo' },
      physician,
    );
  });

  let registrationSequence = 0;
  function createInput(
    actor: AuthenticatedUserPayload,
    fullName: string,
    inductionStartDate = '2026-01-01T13:00:00Z',
  ): CreateImmunotherapyDto {
    registrationSequence += 1;
    return {
      idempotencyKey: `schedule-${registrationSequence}`,
      patient: {
        fullName,
        birthDate: new Date('1990-01-01'),
        weightInKg: 70,
        phoneNumber: '11999999999',
        responsiblePhysicianId: actor.professionalId!,
      },
      immunoType: 'Synthetic',
      administrationRoute: 'SUBCUTANEOUS',
      extract: 'Synthetic extract',
      inductionStartDate,
      stepIds: ['low', 'middle', 'high'],
      startingStepId: 'low',
      targetStepId: 'high',
    };
  }

  async function administerFirst(
    doseId: string,
    actor: AuthenticatedUserPayload,
    administeredAt: string,
  ) {
    registrationSequence += 1;
    return (await clinical.administer(
      doseId,
      {
        values: {
          concentration: '1000',
          volume: '0.1',
          intervalDays: 7,
          stepId: 'low',
        },
        administeredAt,
        expectedRevision: 0,
        expectedTherapyRevision: 0,
        idempotencyKey: `schedule-cmd-${registrationSequence}`,
        betweenDosesReport: '',
      },
      actor,
    )) as { successor: { id: string } | null };
  }

  const JAN = {
    from: '2026-01-01T00:00:00-03:00',
    to: '2026-01-31T23:59:59-03:00',
  };

  it('lists the period with pagination, calendar summary and stable order', async () => {
    const result = await create.execute(
      createInput(physician, 'Paciente Um'),
      physician,
    );
    await administerFirst(
      result.firstDose.id,
      physician,
      '2026-01-01T13:00:00Z',
    );

    const page = await schedule.list(
      { ...JAN, page: 1, pageSize: 10 },
      physician,
    );
    // Administrada (01/01) e sucessora prevista (08/01) na mesma consulta.
    expect(page.total).toBe(2);
    expect(page.items[0].administeredAt).not.toBeNull();
    expect(page.items[1].status).toBe('SCHEDULED');
    expect(page.items[0].immunotherapy.patient.fullName).toBe('Paciente Um');
    expect(page.items[0].immunotherapy.patient.responsiblePhysician.id).toBe(
      physician.professionalId,
    );
    const second = await schedule.list(
      { ...JAN, page: 2, pageSize: 1 },
      physician,
    );
    expect(second.items).toHaveLength(1);
    expect(second.total).toBe(2);
  });

  it('scopes the aggregate by physician, role and organization', async () => {
    const colleague = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['PHYSICIAN'],
    );
    const nurse = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['NURSE'],
    );
    const outsider =
      await factories.users.createAuthenticatedPhysicianProfessional();
    await create.execute(createInput(physician, 'Do Titular'), physician);
    await create.execute(createInput(colleague, 'Do Colega'), colleague);

    const mine = await schedule.list({ ...JAN }, physician);
    expect(mine.total).toBe(1);
    expect(mine.items[0].immunotherapy.patient.fullName).toBe('Do Titular');

    const nurseView = await schedule.list({ ...JAN }, nurse);
    expect(nurseView.total).toBe(2);

    const outside = await schedule.list({ ...JAN }, outsider);
    expect(outside.total).toBe(0);

    const searched = await schedule.list({ ...JAN, search: 'colega' }, nurse);
    expect(searched.total).toBe(1);
    const byPhysician = await schedule.list(
      { ...JAN, responsiblePhysicianId: colleague.professionalId! },
      nurse,
    );
    expect(byPhysician.total).toBe(1);
    const scheduledOnly = await schedule.list(
      { ...JAN, status: 'SCHEDULED' },
      nurse,
    );
    expect(scheduledOnly.total).toBe(2);
  });

  it('rejects an inverted period without querying', async () => {
    await expect(
      schedule.list({ from: JAN.to, to: JAN.from }, physician),
    ).rejects.toThrow(BadRequestException);
    await expect(
      schedule.metrics({ from: JAN.to, to: JAN.from }, physician),
    ).rejects.toThrow('INVALID_PERIOD');
  });

  it('groups applications by the clinical local day across UTC midnight', async () => {
    const result = await create.execute(
      createInput(physician, 'Fuso Local'),
      physician,
    );
    // 02/01 01:00Z = 31/12... não: 2026-01-02T01:00Z = 01/01 22:00 em São Paulo.
    await administerFirst(
      result.firstDose.id,
      physician,
      '2026-01-02T01:00:00Z',
    );

    const metrics = await schedule.metrics({ ...JAN }, physician);
    expect(metrics.timeZone).toBe('America/Sao_Paulo');
    expect(metrics.applications.total).toBe(1);
    expect(metrics.applications.byDay).toEqual([
      { day: '2026-01-01', count: 1 },
    ]);
    // Mesmo dia local do previsto: conta como ON_SCHEDULE.
    expect(metrics.applications.onSchedule).toBe(1);
    expect(metrics.adherence.ratio).toBe(1);
  });

  it('separates on/off schedule, overdue and pending with documented denominators', async () => {
    const first = await create.execute(
      createInput(physician, 'Aderente'),
      physician,
    );
    const administered = await administerFirst(
      first.firstDose.id,
      physician,
      '2026-01-01T13:00:00Z',
    );
    // Sucessora prevista para 08/01; administrada fora do dia local previsto.
    const successor = (await clinical.read(
      administered.successor!.id,
      physician,
    )) as { revision: number; therapyRevision: number };
    registrationSequence += 1;
    await clinical.administer(
      administered.successor!.id,
      {
        values: {
          concentration: '1000',
          volume: '0.2',
          intervalDays: 7,
          stepId: 'middle',
        },
        administeredAt: '2026-01-10T13:00:00Z',
        expectedRevision: successor.revision,
        expectedTherapyRevision: successor.therapyRevision,
        idempotencyKey: `schedule-cmd-${registrationSequence}`,
        betweenDosesReport: '',
        reason: 'Paciente remarcou por viagem.',
      },
      physician,
    );
    // Terapia futura: previsão pendente ainda não vencida.
    await create.execute(
      createInput(physician, 'Futuro', '2026-12-01T13:00:00Z'),
      physician,
    );

    const year = await schedule.metrics(
      { from: '2026-01-01T00:00:00-03:00', to: '2026-12-31T23:59:59-03:00' },
      physician,
    );
    expect(year.applications.total).toBe(2);
    expect(year.applications.onSchedule).toBe(1);
    expect(year.applications.offSchedule).toBe(1);
    expect(year.adherence).toEqual({
      numerator: 1,
      denominator: 2,
      ratio: 0.5,
    });
    // Sucessora de 17/01 está vencida; a previsão de dezembro ainda não.
    expect(year.scheduled.overdue).toBe(1);
    expect(year.scheduled.pending).toBe(1);
    expect(year.therapies.inProgress).toBe(2);
    expect(year.therapies.buildUp).toBe(2);
    expect(year.therapies.maintenance).toBe(0);
  });

  it('returns a null adherence ratio when there is no base, never a mock number', async () => {
    await create.execute(createInput(physician, 'Sem Aplicação'), physician);
    const metrics = await schedule.metrics({ ...JAN }, physician);
    expect(metrics.applications.total).toBe(0);
    expect(metrics.adherence.ratio).toBeNull();
  });
});
