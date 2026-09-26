import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ProtocolMigrationService } from '../protocol-migration.service';

describe('Legacy migration report for the assisted UI - Integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let migration: ProtocolMigrationService;
  let factories: TestFactories;
  let physician: AuthenticatedUserPayload;

  beforeAll(async () => {
    await TestDatabaseManager.connect();
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();
    prisma = module.get(PrismaService);
    migration = module.get(ProtocolMigrationService);
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
  });

  async function legacyTherapy() {
    const patient = await factories.patients.create({
      organizationId: physician.organizationId,
      responsiblePhysicianId: physician.professionalId!,
      fullName: 'Paciente Legado',
      createdById: physician.id,
      updatedById: physician.id,
    });
    const therapy = await factories.immunotherapies.create({
      patientId: patient.id,
      targetConcentration: 1000,
      targetVolume: 0.4,
      inductionStartDate: new Date('2026-01-01T13:00:00Z'),
      createdById: physician.id,
      updatedById: physician.id,
    });
    const dose = await factories.doses.create({
      immunotherapyId: therapy.id,
      concentration: 1000,
      volume: 0.2,
      nextIntervalInDays: 7,
      scheduledAt: new Date('2026-01-08T13:00:00Z'),
      createdById: physician.id,
      updatedById: physician.id,
    });
    return { patient, therapy, dose };
  }

  it('identifies the record under review: patient, therapy and pending dose values', async () => {
    const { patient, therapy, dose } = await legacyTherapy();
    const inventory = await migration.inventory(physician);
    const row = inventory.report.find(
      (entry) => entry.therapyId === therapy.id,
    )!;
    expect(row.patient).toEqual({
      id: patient.id,
      fullName: 'Paciente Legado',
      isActive: true,
    });
    expect(row.immunoType).toBe(therapy.immunoType);
    expect(row.status).toBe('IN_PROGRESS');
    expect(row.issues).toContain('PROTOCOL_NOT_BOUND');
    expect(row.pendingDoses).toEqual([
      {
        id: dose.id,
        scheduledAt: dose.scheduledAt,
        concentration: '1000',
        volume: '0.2',
        intervalDays: 7,
      },
    ]);
    expect(await prisma.protocolPrescription.count()).toBe(0);
    expect(await prisma.treatmentProtocol.count()).toBe(0);
  });

  it('returns the technical draft with its versions on both creation and replay', async () => {
    await legacyTherapy();
    const first = (await migration.createOriginDraft(physician)) as {
      id: string;
      versions: { id: string; status: string; number: number }[];
    };
    expect(first.versions).toHaveLength(1);
    expect(first.versions[0].status).toBe('DRAFT');
    const replay = (await migration.createOriginDraft(physician)) as {
      id: string;
      versions: { id: string }[];
    };
    expect(replay.id).toBe(first.id);
    expect(replay.versions[0].id).toBe(first.versions[0].id);
    expect(await prisma.treatmentProtocol.count()).toBe(1);
  });
});
