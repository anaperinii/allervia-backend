import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { syntheticProtocolDefinition } from 'test/fixtures/configured-protocol';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ProtocolCatalogService } from '../../../../protocol-catalog/protocol-catalog.service';
import { ConfiguredDoseService } from '../../../configured-dose.service';
import { CreateImmunotherapyUseCase } from '../../../../therapies/use-cases/create-immunotherapy.use-case';
import type { AdministerDoseDto } from '../../../dtos/configured-dose.dto';
import type { CreateImmunotherapyDto } from '../../../../therapies/dtos/create-immunotherapy.dto';

describe('Dose administration extensions - Integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let catalog: ProtocolCatalogService;
  let clinical: ConfiguredDoseService;
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
  function createInput(): CreateImmunotherapyDto {
    registrationSequence += 1;
    return {
      idempotencyKey: `extensions-${registrationSequence}`,
      patient: {
        fullName: 'Synthetic patient',
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
  function command(
    overrides: Partial<AdministerDoseDto> = {},
  ): AdministerDoseDto {
    return {
      values: {
        concentration: '1000',
        volume: '0.1',
        intervalDays: 7,
        stepId: 'low',
      },
      administeredAt: '2026-01-01T13:00:00Z',
      expectedRevision: 0,
      expectedTherapyRevision: 0,
      idempotencyKey: 'extension-request-1',
      betweenDosesReport: '',
      ...overrides,
    };
  }
  async function firstDoseId(): Promise<string> {
    const result = await create.execute(createInput(), physician);
    return result.firstDose.id;
  }

  it('persists administration window, selected performer and registering user separately', async () => {
    const nurse = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['NURSE'],
    );
    const doseId = await firstDoseId();
    await clinical.administer(
      doseId,
      command({
        administrationEndedAt: '2026-01-01T13:30:00Z',
        performedById: nurse.professionalId!,
        immediateConduct: { type: 'MAINTAIN' },
        observations: [
          {
            phase: 'PRE_ADMINISTRATION',
            reportedSideEffects: [],
            administeredMedications: [],
            notes: 'Sem intercorrências no intervalo.',
          },
          {
            phase: 'POST_ADMINISTRATION',
            reportedSideEffects: ['Eritema local'],
            administeredMedications: ['Anti-histamínico'],
          },
        ],
      }),
      physician,
    );
    const dose = await prisma.dose.findUniqueOrThrow({
      where: { id: doseId },
      include: { observations: true },
    });
    expect(dose.administrationEndedAt?.toISOString()).toBe(
      '2026-01-01T13:30:00.000Z',
    );
    expect(dose.performedById).toBe(nurse.professionalId);
    expect(dose.administeredById).toBe(physician.id);
    expect(dose.immediateConduct).toBe('MAINTAIN');
    expect(dose.observations).toHaveLength(2);
    expect(
      dose.observations.find((o) => o.phase === 'POST_ADMINISTRATION')
        ?.reportedSideEffects,
    ).toEqual(['Eritema local']);
  });

  it('defaults the performer to the authenticated professional', async () => {
    const doseId = await firstDoseId();
    await clinical.administer(doseId, command(), physician);
    const dose = await prisma.dose.findUniqueOrThrow({ where: { id: doseId } });
    expect(dose.performedById).toBe(physician.professionalId);
    expect(dose.immediateConduct).toBeNull();
    expect(dose.administrationEndedAt).toBeNull();
  });

  it('rejects an administration window that ends before it starts, writing nothing', async () => {
    const doseId = await firstDoseId();
    await expect(
      clinical.administer(
        doseId,
        command({ administrationEndedAt: '2026-01-01T12:59:00Z' }),
        physician,
      ),
    ).rejects.toThrow(BadRequestException);
    const dose = await prisma.dose.findUniqueOrThrow({ where: { id: doseId } });
    expect(dose.status).toBe('SCHEDULED');
    expect(await prisma.clinicalCommand.count()).toBe(0);
  });

  it('rejects performers without an active clinical role or outside the organization', async () => {
    const receptionist = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['RECEPTIONIST'],
    );
    const outsider =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const doseId = await firstDoseId();
    for (const performedById of [
      receptionist.professionalId!,
      outsider.professionalId!,
      'unknown-professional',
    ]) {
      await expect(
        clinical.administer(doseId, command({ performedById }), physician),
      ).rejects.toThrow('PERFORMER_NOT_AUTHORIZED');
    }
    const dose = await prisma.dose.findUniqueOrThrow({ where: { id: doseId } });
    expect(dose.status).toBe('SCHEDULED');
  });

  it('requires justification for any conduct other than MAINTAIN', async () => {
    const doseId = await firstDoseId();
    await expect(
      clinical.administer(
        doseId,
        command({ immediateConduct: { type: 'REQUEST_PHYSICIAN_REVIEW' } }),
        physician,
      ),
    ).rejects.toThrow('CONDUCT_JUSTIFICATION_REQUIRED');
  });

  it('lets nursing request physician review but not suspend the treatment', async () => {
    const nurse = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['NURSE'],
    );
    const doseId = await firstDoseId();
    await expect(
      clinical.administer(
        doseId,
        command({
          immediateConduct: {
            type: 'SUSPEND_TREATMENT',
            justification: 'Reação extensa imediata.',
          },
        }),
        nurse,
      ),
    ).rejects.toThrow(ForbiddenException);
    let dose = await prisma.dose.findUniqueOrThrow({ where: { id: doseId } });
    expect(dose.status).toBe('SCHEDULED');
    expect(
      (
        await prisma.immunotherapy.findUniqueOrThrow({
          where: { id: dose.immunotherapyId },
        })
      ).status,
    ).toBe('IN_PROGRESS');

    await clinical.administer(
      doseId,
      command({
        immediateConduct: {
          type: 'REQUEST_PHYSICIAN_REVIEW',
          justification: 'Eritema maior que o esperado; avaliar prescrição.',
        },
      }),
      nurse,
    );
    dose = await prisma.dose.findUniqueOrThrow({ where: { id: doseId } });
    expect(dose.immediateConduct).toBe('REQUEST_PHYSICIAN_REVIEW');
    expect(dose.status).toBe('ADMINISTERED_ON_SCHEDULE');
  });

  it('suspends the therapy transactionally when the physician decides so', async () => {
    const doseId = await firstDoseId();
    const result = (await clinical.administer(
      doseId,
      command({
        immediateConduct: {
          type: 'SUSPEND_TREATMENT',
          justification: 'Reação sistêmica: suspender até reavaliação.',
        },
      }),
      physician,
    )) as { successor: { id: string } | null };
    const dose = await prisma.dose.findUniqueOrThrow({ where: { id: doseId } });
    const therapy = await prisma.immunotherapy.findUniqueOrThrow({
      where: { id: dose.immunotherapyId },
    });
    expect(dose.status).toBe('ADMINISTERED_ON_SCHEDULE');
    expect(therapy.status).toBe('SUSPENDED');
    // A sucessora fica planejada para a retomada; a terapia suspensa bloqueia comandos.
    expect(result.successor).not.toBeNull();
    expect(
      await prisma.auditLog.count({
        where: { action: 'IMMUNOTHERAPY_STATUS_CHANGED' },
      }),
    ).toBe(1);
    await expect(
      clinical.administer(
        result.successor!.id,
        command({
          administeredAt: '2026-01-08T13:00:00Z',
          idempotencyKey: 'extension-request-2',
        }),
        physician,
      ),
    ).rejects.toThrow('TREATMENT_NOT_ACTIVE');
  });

  it('replays the original result for the same key and body including the new fields', async () => {
    const doseId = await firstDoseId();
    const body = command({
      administrationEndedAt: '2026-01-01T13:20:00Z',
      immediateConduct: { type: 'MAINTAIN' },
    });
    const first = await clinical.administer(doseId, body, physician);
    const replay = await clinical.administer(doseId, { ...body }, physician);
    expect(replay).toEqual(first);
    expect(await prisma.clinicalCommand.count()).toBe(1);
    expect(await prisma.dose.count()).toBe(2);
    await expect(
      clinical.administer(
        doseId,
        {
          ...body,
          administrationEndedAt: '2026-01-01T13:25:00Z',
        },
        physician,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects duplicated observation phases without writing', async () => {
    const doseId = await firstDoseId();
    await expect(
      clinical.administer(
        doseId,
        command({
          observations: [
            {
              phase: 'POST_ADMINISTRATION',
              reportedSideEffects: [],
              administeredMedications: [],
            },
            {
              phase: 'POST_ADMINISTRATION',
              reportedSideEffects: ['Duplicada'],
              administeredMedications: [],
            },
          ],
        }),
        physician,
      ),
    ).rejects.toThrow('DUPLICATE_OBSERVATION_PHASE');
    expect(await prisma.doseObservation.count()).toBe(0);
    expect(await prisma.clinicalCommand.count()).toBe(0);
  });
});
