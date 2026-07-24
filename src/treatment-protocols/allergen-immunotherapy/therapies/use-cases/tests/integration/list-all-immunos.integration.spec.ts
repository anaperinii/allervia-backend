import { Test, TestingModule } from '@nestjs/testing';
import { ListAllImmunotherapiesUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/list-all-immunotherapies.use-case';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestFactories } from 'test/factories';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { IImmunotherapyRepository } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface';
import { PrismaImmunotherapyRepository } from 'src/treatment-protocols/allergen-immunotherapy/therapies/prisma-immunotherapy.repository';

describe('ListAllImunotherapiesUseCase - Integration', () => {
  let module: TestingModule;
  let listAllUseCase: ListAllImmunotherapiesUseCase;
  let prisma: PrismaService;
  let factories: TestFactories;

  beforeAll(async () => {
    await TestDatabaseManager.connect();

    module = await Test.createTestingModule({
      providers: [
        ListAllImmunotherapiesUseCase,
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

    listAllUseCase = module.get(ListAllImmunotherapiesUseCase);
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

  it('should return all imunotherapies by organization', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const patient = await factories.patients.create({
      organizationId: authenticatedUser.activeOrgId,
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

    console.log(authenticatedUser);

    console.log(immunotherapy.createdById);

    const result = await listAllUseCase.execute(authenticatedUser.activeOrgId);

    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    console.log(JSON.stringify(result, null, 2));
  });

  it('should return an empty list when from another organization', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const authenticatedUserAnotherOrg =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const patient = await factories.patients.create({
      organizationId: authenticatedUser.activeOrgId,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
    });
    await factories.immunotherapies.create({
      inductionStartDate: new Date('2026-01-15'),
      responsiblePhysicianId: authenticatedUser.id,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
      patientId: patient.id,
    });

    const result = await listAllUseCase.execute(
      authenticatedUserAnotherOrg.activeOrgId,
    );

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });
});
