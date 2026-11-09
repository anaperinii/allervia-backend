import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { PhaseTimelineService } from '../../../phase-timeline.service';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

describe('Phase timeline - Integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let factories: TestFactories;
  let service: PhaseTimelineService;
  let physician: AuthenticatedUserPayload;

  beforeAll(async () => {
    await TestDatabaseManager.connect();
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();
    prisma = module.get(PrismaService);
    factories = new TestFactories(prisma);
    service = module.get(PhaseTimelineService);
  });
  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();
    physician =
      await factories.users.createAuthenticatedPhysicianProfessional();
  });
  afterAll(async () => {
    await module.close();
    await TestDatabaseManager.disconnect();
  });

  const query = {
    from: '2026-01-01',
    to: '2026-01-10',
    timeZone: 'America/Sao_Paulo',
  };

  it('counts a patient as build-up before maintenanceStartDate and as maintenance after it', async () => {
    const patient = await factories.patients.create({
      organizationId: physician.organizationId,
      responsiblePhysicianId: physician.professionalId!,
      createdById: physician.id,
      updatedById: physician.id,
      birthDate: new Date('1990-01-01'),
      cpf: null,
    });
    await factories.immunotherapies.create({
      patientId: patient.id,
      createdById: physician.id,
      updatedById: physician.id,
      inductionStartDate: new Date('2026-01-02T13:00:00Z'),
      maintenanceStartDate: new Date('2026-01-06T13:00:00Z'),
    });

    const result = await service.read(query, physician);

    expect(result.totalTherapies).toBe(1);
    const byDate = Object.fromEntries(
      result.days.map((day) => [day.date, day]),
    );
    expect(byDate['2026-01-01']).toMatchObject({ buildUp: 0, maintenance: 0 });
    expect(byDate['2026-01-02']).toMatchObject({ buildUp: 1, maintenance: 0 });
    expect(byDate['2026-01-05']).toMatchObject({ buildUp: 1, maintenance: 0 });
    expect(byDate['2026-01-06']).toMatchObject({ buildUp: 0, maintenance: 1 });
    expect(byDate['2026-01-10']).toMatchObject({ buildUp: 0, maintenance: 1 });
  });

  it('excludes archived and non-in-progress therapies', async () => {
    const patient = await factories.patients.create({
      organizationId: physician.organizationId,
      responsiblePhysicianId: physician.professionalId!,
      createdById: physician.id,
      updatedById: physician.id,
      birthDate: new Date('1990-01-01'),
      cpf: null,
    });
    await factories.immunotherapies.create({
      patientId: patient.id,
      createdById: physician.id,
      updatedById: physician.id,
      inductionStartDate: new Date('2026-01-01T13:00:00Z'),
      status: 'COMPLETED',
    });

    const result = await service.read(query, physician);

    expect(result.totalTherapies).toBe(0);
    expect(result.days.every((day) => day.buildUp + day.maintenance === 0)).toBe(
      true,
    );
  });

  it('caps the window at 366 days', async () => {
    await expect(
      service.read(
        { from: '2020-01-01', to: '2026-01-01', timeZone: 'UTC' },
        physician,
      ),
    ).resolves.toMatchObject({ days: expect.any(Array) });
    const result = await service.read(
      { from: '2020-01-01', to: '2026-01-01', timeZone: 'UTC' },
      physician,
    );
    expect(result.days.length).toBeLessThanOrEqual(366);
  });
});
