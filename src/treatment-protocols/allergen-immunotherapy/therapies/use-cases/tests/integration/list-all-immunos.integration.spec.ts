import { Test, TestingModule } from '@nestjs/testing';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
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
        AbilityFactory,
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
      organizationId: authenticatedUser.organizationId,
      responsiblePhysicianId: authenticatedUser.professionalId!,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
    });
    const immunotherapy = await factories.immunotherapies.create({
      inductionStartDate: new Date('2026-01-15'),

      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
      patientId: patient.id,
    });

    const result = await listAllUseCase.execute(authenticatedUser, {});

    expect(result.total).toBeGreaterThan(0);
    const item = result.items.find((entry) => entry.id === immunotherapy.id);
    expect(item?.patient.id).toBe(patient.id);
    expect(item?.responsiblePhysician.id).toBe(
      authenticatedUser.professionalId,
    );
  });

  it('should return an empty list when from another organization', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const authenticatedUserAnotherOrg =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const patient = await factories.patients.create({
      organizationId: authenticatedUser.organizationId,
      responsiblePhysicianId: authenticatedUser.professionalId!,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
    });
    await factories.immunotherapies.create({
      inductionStartDate: new Date('2026-01-15'),

      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
      patientId: patient.id,
    });

    const result = await listAllUseCase.execute(
      authenticatedUserAnotherOrg,
      {},
    );

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});
