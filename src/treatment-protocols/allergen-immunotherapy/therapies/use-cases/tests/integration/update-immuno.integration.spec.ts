import { TestingModule, Test } from '@nestjs/testing';
import { IImmunotherapyRepository } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface';
import { PrismaImmunotherapyRepository } from 'src/treatment-protocols/allergen-immunotherapy/therapies/prisma-immunotherapy.repository';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { UpdateImmunotherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/update-immunotherapy.use-case';
import { ulid } from 'ulid';
import { AdministrationRoute } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('UpdateImmunotherapyUseCase - Integration', () => {
  let module: TestingModule;
  let immunoUpdateUseCase: UpdateImmunotherapyUseCase;
  let prisma: PrismaService;
  let factories: TestFactories;

  beforeAll(async () => {
    await TestDatabaseManager.connect();

    module = await Test.createTestingModule({
      providers: [
        UpdateImmunotherapyUseCase,
        {
          provide: PrismaService,
          useValue: TestDatabaseManager.getInstance(),
        },
        {
          provide: IImmunotherapyRepository,
          useClass: PrismaImmunotherapyRepository,
        },
      ],
    }).compile();

    immunoUpdateUseCase = module.get(UpdateImmunotherapyUseCase);
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

  it('should throw an error and rollback by trying to update a non existing immunotherapy', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const dto = {
      immunoType: 'Pólen',
      administrationRoute: AdministrationRoute.SUBLINGUAL,
    };

    await expect(
      immunoUpdateUseCase.execute(
        ulid(),
        dto,
        authenticatedUser.organizationId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should update an existing immunotherapy correctly', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const patient = await factories.patients.create({
      organizationId: authenticatedUser.organizationId,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
    });

    const immunotherapy = await factories.immunotherapies.create({
      inductionStartDate: new Date('2026-01-15'),
      responsiblePhysicianId: authenticatedUser.id,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
      patientId: patient.id,
    });

    const dto = {
      administrationRoute: AdministrationRoute.SUBLINGUAL,
    };

    const updatedImmunotherapy = await immunoUpdateUseCase.execute(
      immunotherapy.id,
      dto,
      authenticatedUser.organizationId,
    );

    expect(updatedImmunotherapy).toBeDefined();
    expect(updatedImmunotherapy.administrationRoute).toBe(
      AdministrationRoute.SUBLINGUAL,
    );
  });

  it('should return not found exception when updating from another organization', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const authenticatedUserAnotherOrg =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const patient = await factories.patients.create({
      organizationId: authenticatedUser.organizationId,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
    });

    const immunotherapy = await factories.immunotherapies.create({
      inductionStartDate: new Date('2026-01-15'),
      responsiblePhysicianId: authenticatedUser.id,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
      patientId: patient.id,
    });

    const dto = {
      administrationRoute: AdministrationRoute.SUBLINGUAL,
    };

    await expect(
      immunoUpdateUseCase.execute(
        immunotherapy.id,
        dto,
        authenticatedUserAnotherOrg.organizationId,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
