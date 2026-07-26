import { Test, TestingModule } from '@nestjs/testing';
import { FindPatientUseCase } from 'src/patients/use-cases/find-patient.use-case';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestFactories } from 'test/factories';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { PatientRepository } from 'src/patients/patient.repository';
import { PrismaPatientRepository } from 'src/patients/prisma-patient.repository';
import { ulid } from 'ulid';
import { NotFoundException } from '@nestjs/common';

describe('FindPatientUseCase - Integration', () => {
  let module: TestingModule;
  let findPatientUseCase: FindPatientUseCase;
  let prisma: PrismaService;
  let factories: TestFactories;

  beforeAll(async () => {
    await TestDatabaseManager.connect();

    module = await Test.createTestingModule({
      providers: [
        FindPatientUseCase,
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

    findPatientUseCase = module.get(FindPatientUseCase);
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

  it('should return the correct patient by id', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const patient = await factories.patients.create({
      organizationId: authenticatedUser.organizationId,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
    });

    const result = await findPatientUseCase.execute(
      patient.id,
      authenticatedUser.organizationId,
    );

    expect(result).toBeDefined();
    expect(result.id).toBe(patient.id);
    expect(result.fullName).toBe(patient.fullName);
  });

  it('should throw a not found exception when querying a non-existent patient', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    await expect(
      findPatientUseCase.execute(ulid(), authenticatedUser.organizationId),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw a not found exception when querying with another organization id', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const authenticatedUserAnotherOrg =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const patient = await factories.patients.create({
      organizationId: authenticatedUser.organizationId,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
    });

    await expect(
      findPatientUseCase.execute(
        patient.id,
        authenticatedUserAnotherOrg.organizationId,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
