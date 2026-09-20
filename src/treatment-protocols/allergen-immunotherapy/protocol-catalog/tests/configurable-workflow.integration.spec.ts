import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { DomainExceptionFilter } from 'src/infra/filters/domain-exception.filter';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { syntheticProtocolDefinition } from 'test/fixtures/configured-protocol';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ProtocolCatalogService } from '../protocol-catalog.service';
import { ProtocolMigrationService } from '../protocol-migration.service';
import { ConfiguredDoseService } from '../../dosing/configured-dose.service';
import { CreateImmunotherapyUseCase } from '../../therapies/use-cases/create-immunotherapy.use-case';
import { UpdateImmunotherapyUseCase } from '../../therapies/use-cases/update-immunotherapy.use-case';
import type { AdministerDoseDto } from '../../dosing/dtos/configured-dose.dto';
import type { CreateImmunotherapyDto } from '../../therapies/dtos/create-immunotherapy.dto';
import type { ResolvedPrescription } from '../../clinical-rules/protocol-definition';

describe('Configured immunotherapy workflow - Integration and HTTP', () => {
  let module: TestingModule;
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let catalog: ProtocolCatalogService;
  let clinical: ConfiguredDoseService;
  let create: CreateImmunotherapyUseCase;
  let migration: ProtocolMigrationService;
  let factories: TestFactories;
  let user: AuthenticatedUserPayload;
  let versionId: string;
  let protocolId: string;
  beforeAll(async () => {
    await TestDatabaseManager.connect();
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    prisma = module.get(PrismaService);
    catalog = module.get(ProtocolCatalogService);
    clinical = module.get(ConfiguredDoseService);
    create = module.get(CreateImmunotherapyUseCase);
    migration = module.get(ProtocolMigrationService);
    factories = new TestFactories(prisma);
  });
  afterAll(async () => {
    if (app) await app.close();
    await TestDatabaseManager.disconnect();
  });
  beforeEach(async () => {
    jest.restoreAllMocks();
    await TestDatabaseManager.cleanAll();
    user = await factories.users.createAuthenticatedPhysicianProfessional();
    const created = await catalog.create(
      {
        name: 'Synthetic test protocol',
        definition: syntheticProtocolDefinition(),
      },
      user,
    );
    versionId = created.version.id;
    protocolId = created.protocol.id;
    await catalog.mutate(versionId, 0, user, 'publish');
    await catalog.mutate(versionId, 1, user, 'default');
    await catalog.settings(
      { enabled: true, timeZone: 'America/Sao_Paulo' },
      user,
    );
  });
  let registrationSequence = 0;

  function createInput(): CreateImmunotherapyDto {
    registrationSequence += 1;
    return {
      idempotencyKey: `workflow-${registrationSequence}`,
      patient: {
        fullName: 'Synthetic patient',
        birthDate: new Date('1990-01-01'),
        weightInKg: 70,
        phoneNumber: '11999999999',
        responsiblePhysicianId: user.professionalId!,
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
      idempotencyKey: 'request-1',
      betweenDosesReport: '',
      ...overrides,
    };
  }
  function prescription(): ResolvedPrescription {
    return {
      protocolId,
      protocolVersionId: versionId,
      route: 'SUBCUTANEOUS',
      stepIds: ['low', 'middle', 'high'],
      startingStepId: 'low',
      targetStepId: 'high',
    };
  }
  function token(actor = user) {
    return module.get(JwtService).sign({
      sub: actor.id,
      email: actor.email,
      type: actor.type,
      organizationId: actor.organizationId,
      professionalId: actor.professionalId,
      roles: actor.roles,
      tokenVersion: 0,
    });
  }

  it('binds the published default and creates the first dose atomically', async () => {
    const result = await create.execute(createInput(), user);
    expect(result.immunotherapy.prescription.versionId).toBe(versionId);
    expect(result.firstDose.plannedValues).toMatchObject({ volume: '0.1' });
    expect(result.immunotherapy.targetVolumeExact?.toString()).toBe('0.4');
    expect(
      await prisma.auditLog.count({
        where: { action: 'PRESCRIPTION_CREATED' },
      }),
    ).toBe(1);
  });
  it('supports draft editing and rejects editing published content at API and database levels', async () => {
    const draft = await catalog.createVersion(
      protocolId,
      syntheticProtocolDefinition(),
      user,
    );
    await catalog.mutate(
      draft.id,
      0,
      user,
      'edit',
      syntheticProtocolDefinition(),
    );
    await expect(catalog.mutate(draft.id, 0, user, 'publish')).rejects.toThrow(
      ConflictException,
    );
    await expect(
      catalog.mutate(versionId, 1, user, 'edit', {}),
    ).rejects.toThrow(ConflictException);
    await expect(
      prisma.protocolVersion.update({
        where: { id: versionId },
        data: { definition: {} },
      }),
    ).rejects.toThrow();
  });
  it('keeps v1 treatments unchanged after v2 becomes default and v1 is retired', async () => {
    const result = await create.execute(createInput(), user);
    const definition = syntheticProtocolDefinition();
    definition.steps[1].volume = '0.3';
    const draft = await catalog.createVersion(protocolId, definition, user);
    await catalog.mutate(draft.id, 0, user, 'publish');
    await catalog.mutate(draft.id, 1, user, 'default');
    await catalog.mutate(versionId, 1, user, 'retire');
    const preview = await clinical.preview(
      result.firstDose.id,
      command(),
      user,
    );
    expect(preview.recommendation).toMatchObject({
      kind: 'RECOMMENDED',
      values: { volume: '0.2' },
      protocolVersionId: versionId,
    });
    expect(
      (await create.execute(createInput(), user)).immunotherapy.prescription
        .versionId,
    ).toBe(draft.id);
    await expect(
      create.execute({ ...createInput(), protocolVersionId: versionId }, user),
    ).rejects.toThrow(NotFoundException);
  });
  it('does not mutate doses when simulating a configuration', async () => {
    const result = await catalog.simulate(
      versionId,
      {
        prescription: { ...prescription() },
        administered: {
          concentration: '1000',
          volume: '0.2',
          intervalDays: 7,
          route: 'SUBCUTANEOUS',
          volumeUnit: 'mL',
          concentrationUnit: 'DILUTION_DENOMINATOR',
        },
      },
      user,
    );
    expect(result.kind).toBe('RECOMMENDED');
    expect(await prisma.dose.count()).toBe(0);
  });
  it('rejects unauthorized authors and cross-organization versions', async () => {
    await expect(
      catalog.create(
        { name: 'Unauthorized', definition: {} },
        { ...user, roles: ['ADMINISTRATOR'] },
      ),
    ).rejects.toThrow(ForbiddenException);
    const other =
      await factories.users.createAuthenticatedPhysicianProfessional();
    await expect(catalog.read(versionId, other)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      create.execute({ ...createInput(), protocolVersionId: versionId }, other),
    ).rejects.toThrow();
  });
  it('rolls back patient, therapy and first dose if audit fails', async () => {
    jest
      .spyOn(module.get(IAuditLogService), 'record')
      .mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(create.execute(createInput(), user)).rejects.toThrow(
      'audit unavailable',
    );
    expect(await prisma.patient.count()).toBe(0);
    expect(await prisma.immunotherapy.count()).toBe(0);
    expect(await prisma.dose.count()).toBe(0);
  });
  it('rejects unsupported route without creating a patient', async () => {
    await expect(
      create.execute(
        { ...createInput(), administrationRoute: 'SUBLINGUAL' },
        user,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(await prisma.patient.count()).toBe(0);
  });
  it('edits a predicted high value down to middle without creating a successor', async () => {
    const result = await create.execute(
      {
        ...createInput(),
        startingStepId: 'high',
        stepIds: ['high', 'middle'],
        targetStepId: 'high',
      },
      user,
    );
    const edited = await clinical.edit(
      result.firstDose.id,
      {
        values: {
          concentration: '1000',
          volume: '0.2',
          intervalDays: 7,
          stepId: 'middle',
        },
        scheduledAt: '2026-01-01T13:00:00Z',
        reason: 'Clinical adjustment',
        expectedRevision: 0,
        expectedTherapyRevision: 0,
      },
      user,
    );
    expect(await prisma.dose.count()).toBe(1);
    expect(edited.plannedStepId).toBe('middle');
    await clinical.administer(
      edited.id,
      command({
        values: { concentration: '1000', volume: '0.2', intervalDays: 7 },
        expectedRevision: 1,
        expectedTherapyRevision: 1,
      }),
      user,
    );
    expect(
      await prisma.dose.findFirst({ where: { sourceDoseId: edited.id } }),
    ).toMatchObject({ plannedStepId: 'high' });
  });
  it('preserves planned values while persisting a different administered value', async () => {
    const result = await create.execute(createInput(), user);
    await clinical.administer(
      result.firstDose.id,
      command({
        values: { concentration: '1000', volume: '0.2', intervalDays: 7 },
        reason: 'Clinical adjustment',
        observations: [
          {
            phase: 'POST_ADMINISTRATION',
            reportedSideEffects: ['Local reaction'],
            administeredMedications: [],
            notes: 'Observed',
          },
        ],
      }),
      user,
    );
    const dose = await prisma.dose.findUniqueOrThrow({
      where: { id: result.firstDose.id },
      include: { observations: true },
    });
    expect(dose.plannedValues).toMatchObject({ volume: '0.1' });
    expect(dose.administeredValues).toMatchObject({ volume: '0.2' });
    expect(dose.observations).toHaveLength(1);
  });
  it('rejects mismatched ID, invalid value and stale revision without writing', async () => {
    const result = await create.execute(createInput(), user);
    await expect(
      clinical.administer(
        result.firstDose.id,
        command({
          values: {
            concentration: '1000',
            volume: '0.2',
            intervalDays: 7,
            stepId: 'low',
          },
        }),
        user,
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      clinical.administer(
        result.firstDose.id,
        command({
          values: { concentration: '1000', volume: '0.3', intervalDays: 7 },
        }),
        user,
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      clinical.administer(
        result.firstDose.id,
        command({ expectedRevision: 1 }),
        user,
      ),
    ).rejects.toThrow(ConflictException);
    expect(await prisma.dose.count()).toBe(1);
  });
  it('returns the original result on retry and rejects a reused key with another payload', async () => {
    const result = await create.execute(createInput(), user);
    const first = await clinical.administer(
      result.firstDose.id,
      command(),
      user,
    );
    expect(
      await clinical.administer(result.firstDose.id, command(), user),
    ).toEqual(first);
    await expect(
      clinical.administer(
        result.firstDose.id,
        command({ betweenDosesReport: 'changed' }),
        user,
      ),
    ).rejects.toThrow(ConflictException);
    expect(await prisma.dose.count()).toBe(2);
    expect(await prisma.clinicalCommand.count()).toBe(1);
  });
  it.each([true, false])(
    'serializes concurrent administrations, same key = %s',
    async (sameKey) => {
      const result = await create.execute(createInput(), user);
      const outcomes = await Promise.allSettled([
        clinical.administer(result.firstDose.id, command(), user),
        clinical.administer(
          result.firstDose.id,
          command({ idempotencyKey: sameKey ? 'request-1' : 'request-2' }),
          user,
        ),
      ]);
      expect(
        outcomes.filter((outcome) => outcome.status === 'fulfilled'),
      ).toHaveLength(sameKey ? 2 : 1);
      expect(await prisma.dose.count()).toBe(2);
      expect(await prisma.clinicalCommand.count()).toBe(1);
    },
  );
  it('serializes administration against schedule editing', async () => {
    const result = await create.execute(createInput(), user);
    const outcomes = await Promise.allSettled([
      clinical.administer(result.firstDose.id, command(), user),
      clinical.edit(
        result.firstDose.id,
        {
          values: command().values,
          scheduledAt: '2026-01-02T13:00:00Z',
          reason: 'Reschedule',
          expectedRevision: 0,
          expectedTherapyRevision: 0,
        },
        user,
      ),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      await prisma.dose.count({ where: { sourceDoseId: result.firstDose.id } }),
    ).toBeLessThanOrEqual(1);
  });
  it('serializes administration against suspension', async () => {
    const result = await create.execute(createInput(), user);
    const outcomes = await Promise.allSettled([
      clinical.therapyStatus(result.immunotherapy.id, 'SUSPENDED', 0, user),
      clinical.administer(result.firstDose.id, command(), user),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
  });
  it('rejects suspended and disabled treatment administration', async () => {
    const result = await create.execute(createInput(), user);
    await clinical.therapyStatus(result.immunotherapy.id, 'SUSPENDED', 0, user);
    await expect(
      clinical.administer(
        result.firstDose.id,
        command({ expectedTherapyRevision: 1 }),
        user,
      ),
    ).rejects.toThrow(ConflictException);
    await catalog.settings(
      { enabled: false, timeZone: 'America/Sao_Paulo' },
      user,
    );
    await expect(create.execute(createInput(), user)).rejects.toThrow(
      ConflictException,
    );
  });
  it('rolls back administration, successor and idempotency if audit fails', async () => {
    const result = await create.execute(createInput(), user);
    jest
      .spyOn(module.get(IAuditLogService), 'record')
      .mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(
      clinical.administer(result.firstDose.id, command(), user),
    ).rejects.toThrow();
    expect(await prisma.dose.count()).toBe(1);
    expect(await prisma.clinicalCommand.count()).toBe(0);
    expect(
      await prisma.dose.findUnique({ where: { id: result.firstDose.id } }),
    ).toMatchObject({ status: 'SCHEDULED', revision: 0, administeredAt: null });
  });
  it('rolls back the administered record when successor persistence fails', async () => {
    const result = await create.execute(createInput(), user);
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Dose" ADD CONSTRAINT test_block_successor CHECK ("sourceDoseId" IS NULL) NOT VALID',
    );
    try {
      await expect(
        clinical.administer(result.firstDose.id, command(), user),
      ).rejects.toThrow();
    } finally {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Dose" DROP CONSTRAINT test_block_successor',
      );
    }
    expect(
      await prisma.dose.findUnique({ where: { id: result.firstDose.id } }),
    ).toMatchObject({ status: 'SCHEDULED', revision: 0 });
    expect(await prisma.clinicalCommand.count()).toBe(0);
  });
  it('does not complete therapy automatically at configured end', async () => {
    const definition = syntheticProtocolDefinition();
    const ending = {
      ...definition,
      steps: [{ ...definition.steps[0], nextStepId: null }],
    };
    const draft = await catalog.createVersion(protocolId, ending, user);
    await catalog.mutate(draft.id, 0, user, 'publish');
    const result = await create.execute(
      {
        ...createInput(),
        protocolVersionId: draft.id,
        stepIds: ['low'],
        targetStepId: 'low',
      },
      user,
    );
    await clinical.administer(result.firstDose.id, command(), user);
    expect(await prisma.dose.count()).toBe(1);
    expect(
      await prisma.immunotherapy.findUnique({
        where: { id: result.immunotherapy.id },
      }),
    ).toMatchObject({ status: 'IN_PROGRESS' });
  });
  it('rejects generic prescription mutation', async () => {
    const result = await create.execute(createInput(), user);
    await expect(
      module.get(UpdateImmunotherapyUseCase).execute(
        result.immunotherapy.id,
        {
          expectedRevision: 0,
          immunoType: 'Updated',
          ...{ targetVolume: 0.9 },
        },
        user,
      ),
    ).rejects.toThrow(BadRequestException);
  });
  it('uses real HTTP DTOs and guards for editable values and administration', async () => {
    const result = await create.execute(createInput(), user);
    const auth = `Bearer ${token()}`;
    await request(app.getHttpServer())
      .patch(`/doses/${result.firstDose.id}/scheduled`)
      .set('Authorization', auth)
      .send({
        values: { concentration: '1000', volume: '0.2', intervalDays: 7 },
        scheduledAt: '2026-01-01T13:00:00Z',
        reason: 'Adjustment',
        expectedRevision: 0,
        expectedTherapyRevision: 0,
      })
      .expect(200);
    expect(await prisma.dose.count()).toBe(1);
    await request(app.getHttpServer())
      .post(`/doses/${result.firstDose.id}/administer`)
      .set('Authorization', auth)
      .send(
        command({
          values: { concentration: '1000', volume: '0.2', intervalDays: 7 },
          expectedRevision: 1,
          expectedTherapyRevision: 1,
        }),
      )
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/doses/${result.firstDose.id}`)
      .set('Authorization', auth)
      .send({ volume: 0.3 })
      .expect(410);
    await request(app.getHttpServer())
      .get(`/doses/${result.firstDose.id}`)
      .expect(401);
  });
  it('rejects numeric decimals and missing revision over HTTP', async () => {
    const result = await create.execute(createInput(), user);
    await request(app.getHttpServer())
      .post(`/doses/${result.firstDose.id}/administer`)
      .set('Authorization', `Bearer ${token()}`)
      .send({
        ...command(),
        values: { volume: 0.2, concentration: 1000, intervalDays: 7 },
        expectedRevision: undefined,
      })
      .expect(400);
    expect(await prisma.dose.count()).toBe(1);
  });
  it('denies nurse publication through HTTP and cross-organization dose access', async () => {
    // O papel vem do vínculo gravado, não do token: um enfermeiro de verdade da
    // mesma organização é quem prova a negação.
    const nurse = await factories.users.createColleagueWithRoles(
      user.organizationId,
      ['NURSE'],
    );
    await request(app.getHttpServer())
      .post(`/treatment-protocols/versions/${versionId}/publish`)
      .set('Authorization', `Bearer ${token(nurse)}`)
      .send({ expectedRevision: 1 })
      .expect(403);
    const result = await create.execute(createInput(), user);
    const other =
      await factories.users.createAuthenticatedPhysicianProfessional();
    await request(app.getHttpServer())
      .get(`/doses/${result.firstDose.id}`)
      .set('Authorization', `Bearer ${token(other)}`)
      .expect(404);
  });

  async function legacy() {
    const patient = await factories.patients.create({
      organizationId: user.organizationId,
      responsiblePhysicianId: user.professionalId!,
      createdById: user.id,
      updatedById: user.id,
    });
    const therapy = await factories.immunotherapies.create({
      patientId: patient.id,
      targetConcentration: 1000,
      targetVolume: 0.4,
      inductionStartDate: new Date('2026-01-01T13:00:00Z'),
      createdById: user.id,
      updatedById: user.id,
    });
    const dose = await factories.doses.create({
      immunotherapyId: therapy.id,
      concentration: 1000,
      volume: 0.2,
      nextIntervalInDays: 7,
      scheduledAt: new Date('2026-01-08T13:00:00Z'),
      createdById: user.id,
      updatedById: user.id,
    });
    return { therapy, dose };
  }
  it('inventories legacy values without writes and blocks the old fallback', async () => {
    const { dose } = await legacy();
    const report = await migration.inventory(user);
    expect(report.dryRun).toBe(true);
    expect(report.report[0].issues).toContain('PROTOCOL_NOT_BOUND');
    expect(await prisma.protocolPrescription.count()).toBe(0);
    await expect(clinical.administer(dose.id, command(), user)).rejects.toThrow(
      ConflictException,
    );
  });
  it('creates an idempotent technical draft that requires clinical review before publication', async () => {
    await legacy();
    const first = await migration.createOriginDraft(user);
    const second = await migration.createOriginDraft(user);
    expect(second.id).toBe(first.id);
    const draft = await prisma.protocolVersion.findFirstOrThrow({
      where: { protocolId: first.id },
    });
    await expect(catalog.mutate(draft.id, 0, user, 'publish')).rejects.toThrow(
      BadRequestException,
    );
  });
  it('dry-runs and binds a legacy pending value idempotently without altering its date or volume', async () => {
    const { therapy, dose } = await legacy();
    expect(
      await migration.bind(therapy.id, versionId, prescription(), 0, user),
    ).toMatchObject({ dryRun: true, stepId: 'middle' });
    expect(await prisma.protocolPrescription.count()).toBe(0);
    await migration.bind(therapy.id, versionId, prescription(), 0, user, false);
    expect(
      await migration.bind(
        therapy.id,
        versionId,
        prescription(),
        0,
        user,
        false,
      ),
    ).toMatchObject({ alreadyBound: true });
    expect(await prisma.protocolPrescription.count()).toBe(1);
    expect(
      await prisma.dose.findUnique({ where: { id: dose.id } }),
    ).toMatchObject({
      scheduledAt: dose.scheduledAt,
      volume: dose.volume,
      plannedStepId: 'middle',
    });
  });
  it('rejects unmatched legacy values instead of rounding them', async () => {
    const { therapy, dose } = await legacy();
    await prisma.$executeRaw`UPDATE "Dose" SET volume = CAST(${'0.20000000000000004'} AS double precision) WHERE id = ${dose.id}`;
    const stored = await prisma.$queryRaw<
      { value: string }[]
    >`SELECT volume::text AS value FROM "Dose" WHERE id = ${dose.id}`;
    expect(stored[0].value).toBe('0.20000000000000004');
    await expect(
      migration.bind(therapy.id, versionId, prescription(), 0, user, false),
    ).rejects.toThrow(BadRequestException);
    expect(await prisma.protocolPrescription.count()).toBe(0);
  });
  it('registers a prescription through the real HTTP validation pipeline', async () => {
    const response = await request(app.getHttpServer())
      .post('/immunotherapies/register')
      .set('Authorization', `Bearer ${token()}`)
      .send(createInput())
      .expect(201);
    expect(response.body).toMatchObject({
      immunotherapy: { prescription: { versionId } },
      firstDose: { plannedStepId: 'low' },
    });
  });
  it('prevents direct mutation of a bound prescription and administered dose', async () => {
    const result = await create.execute(createInput(), user);
    await expect(
      prisma.protocolPrescription.update({
        where: { id: result.immunotherapy.prescription.id },
        data: { resolved: {} },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.immunotherapy.update({
        where: { id: result.immunotherapy.id },
        data: { targetVolume: 0.9 },
      }),
    ).rejects.toThrow();
    await clinical.administer(result.firstDose.id, command(), user);
    await expect(
      prisma.dose.update({
        where: { id: result.firstDose.id },
        data: { volume: 0.9 },
      }),
    ).rejects.toThrow();
  });
  it('enforces organization relationships at the database boundary', async () => {
    const other =
      await factories.users.createAuthenticatedPhysicianProfessional();
    await expect(
      prisma.organizationProtocolDefault.create({
        data: {
          organizationId: other.organizationId,
          route: 'SUBCUTANEOUS',
          versionId,
        },
      }),
    ).rejects.toThrow();
    const { therapy } = await legacy();
    const otherProtocol = await catalog.create(
      { name: 'Other', definition: syntheticProtocolDefinition() },
      other,
    );
    await catalog.mutate(otherProtocol.version.id, 0, other, 'publish');
    await expect(
      prisma.protocolPrescription.create({
        data: {
          immunotherapyId: therapy.id,
          organizationId: other.organizationId,
          versionId: otherProtocol.version.id,
          resolved: {},
          createdById: other.id,
        },
      }),
    ).rejects.toThrow();
  });
  it('preserves administered legacy history during binding', async () => {
    const { therapy } = await legacy();
    const historical = await factories.doses.create({
      immunotherapyId: therapy.id,
      concentration: 1000,
      volume: 0.1,
      nextIntervalInDays: 7,
      status: 'ADMINISTERED_ON_SCHEDULE',
      scheduledAt: new Date('2026-01-01T13:00:00Z'),
      administeredAt: new Date('2026-01-01T13:00:00Z'),
      administeredById: user.id,
      createdById: user.id,
      updatedById: user.id,
    });
    await migration.bind(therapy.id, versionId, prescription(), 0, user, false);
    expect(
      await prisma.dose.findUnique({ where: { id: historical.id } }),
    ).toEqual(historical);
  });
  it('reports duplicate legacy planning and refuses automatic binding', async () => {
    const { therapy } = await legacy();
    await factories.doses.create({
      immunotherapyId: therapy.id,
      concentration: 1000,
      volume: 0.2,
      nextIntervalInDays: 7,
      scheduledAt: new Date('2026-01-09T13:00:00Z'),
      createdById: user.id,
      updatedById: user.id,
    });
    const inventory = await migration.inventory(user);
    expect(inventory.report[0].issues).toContain('MULTIPLE_PENDING_DOSES');
    await expect(
      migration.bind(therapy.id, versionId, prescription(), 0, user, false),
    ).rejects.toThrow(ConflictException);
  });
  it('pins the prescription calendar even when organizational defaults change', async () => {
    const result = await create.execute(createInput(), user);
    await catalog.settings(
      { enabled: true, timeZone: 'America/New_York' },
      user,
    );
    const preview = await clinical.preview(
      result.firstDose.id,
      command({ administeredAt: '2026-03-07T13:00:00Z' }),
      user,
    );
    expect(preview.nextScheduledAt?.toISOString()).toBe(
      '2026-03-14T13:00:00.000Z',
    );
    const stored = await prisma.protocolPrescription.findUniqueOrThrow({
      where: { immunotherapyId: result.immunotherapy.id },
    });
    expect(stored.resolved).toMatchObject({ timeZone: 'America/Sao_Paulo' });
  });
  it('compares the legacy target without losing PostgreSQL float precision', async () => {
    const { therapy } = await legacy();
    await prisma.$executeRaw`UPDATE "Immunotherapy" SET "targetVolume" = CAST(${'0.4000000000000001'} AS double precision) WHERE id = ${therapy.id}`;
    const inventory = await migration.inventory(user);
    expect(inventory.report[0].target.volume).toBe('0.4000000000000001');
    await expect(
      migration.bind(therapy.id, versionId, prescription(), 0, user, false),
    ).rejects.toThrow(ConflictException);
    expect(await prisma.protocolPrescription.count()).toBe(0);
  });
  it('serializes version retirement with administration while preserving the adopted version', async () => {
    const result = await create.execute(createInput(), user);
    const outcomes = await Promise.allSettled([
      catalog.mutate(versionId, 1, user, 'retire'),
      clinical.administer(result.firstDose.id, command(), user),
    ]);
    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'fulfilled',
      'fulfilled',
    ]);
    expect(await prisma.dose.count()).toBe(2);
    expect(
      (
        await prisma.protocolPrescription.findUniqueOrThrow({
          where: { immunotherapyId: result.immunotherapy.id },
        })
      ).versionId,
    ).toBe(versionId);
  });
});
