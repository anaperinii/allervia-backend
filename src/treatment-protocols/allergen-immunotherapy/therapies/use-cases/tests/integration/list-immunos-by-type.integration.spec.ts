import { Test, TestingModule } from '@nestjs/testing';
import { ListImmunotherapiesByTypeUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/list-immunotherapies-by-type.use-case';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestFactories } from 'test/factories';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { IImmunotherapyRepository } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface';
import { PrismaImmunotherapyRepository } from 'src/treatment-protocols/allergen-immunotherapy/therapies/prisma-immunotherapy.repository';

describe('ListImmunotherapiesByTypeUseCase - Integration', () => {
  let module: TestingModule;
  let listAllByType: ListImmunotherapiesByTypeUseCase;
  let prisma: PrismaService;
  let factories: TestFactories;

  beforeAll(async () => {
    await TestDatabaseManager.connect();

    module = await Test.createTestingModule({
      providers: [
        ListImmunotherapiesByTypeUseCase,
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

    listAllByType = module.get(ListImmunotherapiesByTypeUseCase);
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

  it('should list all immunotherapies by type correctly', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const patients = await factories.patients.createMany(4, {
      organizationId: authenticatedUser.organizationId,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
    });

    for (let i = 0; i < 4; i++) {
      await factories.immunotherapies.create({
        immunoType: i % 2 === 0 ? 'Ácaros' : 'Pólen',
        inductionStartDate: new Date('2026-01-15'),
        responsiblePhysicianId: authenticatedUser.id,
        createdById: authenticatedUser.id,
        updatedById: authenticatedUser.id,
        patientId: patients[i].id,
      });
    }

    const resultAcaros = await listAllByType.execute(
      'Ácaros',
      authenticatedUser.organizationId,
    );
    const resultPolen = await listAllByType.execute(
      'Pólen',
      authenticatedUser.organizationId,
    );

    expect(resultAcaros).toHaveLength(2);
    console.log(resultAcaros);
    expect(resultPolen).toHaveLength(2);
    console.log(resultPolen);
  });
});
