import { Test, TestingModule } from '@nestjs/testing';
import { ListPatientsUseCase } from 'src/patients/use-cases/list-patients.use-case';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestFactories } from 'test/factories';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { PatientRepository } from 'src/patients/patient.repository';
import { PrismaPatientRepository } from 'src/patients/prisma-patient.repository';

describe('ListPatientsUseCase - Integration', () => {
  let module: TestingModule;
  let listPatientsUseCase: ListPatientsUseCase;
  let prisma: PrismaService;
  let factories: TestFactories;

  beforeAll(async () => {
    await TestDatabaseManager.connect();

    module = await Test.createTestingModule({
      providers: [
        ListPatientsUseCase,
        {
          provide: PrismaService,
          useValue: TestDatabaseManager.getInstance(),
        },
        {
          provide: PatientRepository,
          useClass: PrismaPatientRepository,
        },
      ],
    }).compile();

    listPatientsUseCase = module.get(ListPatientsUseCase);
    prisma = module.get(PrismaService);
    factories = new TestFactories(prisma);
  });

  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
    await TestDatabaseManager.disconnect();
  });

  it('should return all patients by organization', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const patient1 = await factories.patients.create({
      organizationId: authenticatedUser.organizationId,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
    });

    const patient2 = await factories.patients.create({
      organizationId: authenticatedUser.organizationId,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
    });

    const result = await listPatientsUseCase.execute(
      authenticatedUser.organizationId,
    );

    expect(result).toBeDefined();
    expect(result.length).toBe(2);
    expect(result.some((p) => p.id === patient1.id)).toBe(true);
    expect(result.some((p) => p.id === patient2.id)).toBe(true);
  });

  it('should return empty array when organization has no patients', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const result = await listPatientsUseCase.execute(
      authenticatedUser.organizationId,
    );

    expect(result).toBeDefined();
    expect(result.length).toBe(0);
  });

  it('should not return patients from another organization', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const authenticatedUserAnotherOrg =
      await factories.users.createAuthenticatedPhysicianProfessional();

    await factories.patients.create({
      organizationId: authenticatedUser.organizationId,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
    });

    await factories.patients.create({
      organizationId: authenticatedUserAnotherOrg.organizationId,
      createdById: authenticatedUserAnotherOrg.id,
      updatedById: authenticatedUserAnotherOrg.id,
    });

    const result = await listPatientsUseCase.execute(
      authenticatedUser.organizationId,
    );

    expect(result).toBeDefined();
    expect(result.length).toBe(1);
    expect(result[0].organizationId).toBe(authenticatedUser.organizationId);
  });
});
