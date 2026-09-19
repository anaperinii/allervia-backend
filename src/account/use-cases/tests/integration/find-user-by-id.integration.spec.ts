import { Test, TestingModule } from '@nestjs/testing';
import { FindUserByIdUseCase } from 'src/account/use-cases/find-user-by-id.use-case';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestFactories } from 'test/factories';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { PrismaUserRepository } from 'src/account/prisma-user.repository';
import { ulid } from 'ulid';
import { IUserRepository } from 'src/account/user.repository';
import { NotFoundException } from '@nestjs/common';

describe('FindUserByIdUseCase - Integration', () => {
  let module: TestingModule;
  let findUserByIdUseCase: FindUserByIdUseCase;
  let prisma: PrismaService;
  let factories: TestFactories;

  beforeAll(async () => {
    await TestDatabaseManager.connect();

    module = await Test.createTestingModule({
      providers: [
        FindUserByIdUseCase,
        {
          provide: PrismaService,
          useValue: TestDatabaseManager.getInstance(),
        },
        {
          provide: IUserRepository,
          useClass: PrismaUserRepository,
        },
      ],
    }).compile();

    findUserByIdUseCase = module.get(FindUserByIdUseCase);
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

  it('should return the user correctly by id', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const result = await findUserByIdUseCase.execute(
      authenticatedUser.id,
      authenticatedUser,
    );

    expect(result).toBeDefined();
    expect(result.id).toBe(authenticatedUser.id);
    expect(result.email).toBe(authenticatedUser.email);
  });

  it('should return a professional user with the administrator role', async () => {
    const systemAdmin = await factories.users.createAuthenticatedAdmin();

    const result = await findUserByIdUseCase.execute(
      systemAdmin.id,
      systemAdmin,
    );

    expect(result).toBeDefined();
    expect(result.id).toBe(systemAdmin.id);
    expect(result.type).toBe('PROFESSIONAL');
  });

  it('should throw a not found exception when querying a non-existent user', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    await expect(
      findUserByIdUseCase.execute(ulid(), authenticatedUser),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw a not found exception when querying with another organization id', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const authenticatedUserAnotherOrg =
      await factories.users.createAuthenticatedPhysicianProfessional();

    await expect(
      findUserByIdUseCase.execute(
        authenticatedUser.id,
        authenticatedUserAnotherOrg,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject a request without organization context', async () => {
    const authenticatedAdmin = await factories.users.createAuthenticatedAdmin();

    await expect(
      findUserByIdUseCase.execute(authenticatedAdmin.id, {
        ...authenticatedAdmin,
        organizationId: '',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
