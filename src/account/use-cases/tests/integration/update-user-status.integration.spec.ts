import { Test, TestingModule } from '@nestjs/testing';
import { UpdateUserStatusUseCase } from 'src/account/use-cases/update-user-status.use-case';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestFactories } from 'test/factories';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { PrismaUserRepository } from 'src/account/prisma-user.repository';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { PrismaAuditLogService } from 'src/infra/audit/prisma-audit-log.service';
import { ulid } from 'ulid';
import { NotFoundException } from '@nestjs/common';
import { IUserRepository } from 'src/account/user.repository';
import { UpdateUserStatusDto } from 'src/account/dtos/update-user-status.dto';

describe('UpdateUserStatusUseCase - Integration', () => {
  let module: TestingModule;
  let updateUserStatusUseCase: UpdateUserStatusUseCase;
  let prisma: PrismaService;
  let factories: TestFactories;

  beforeAll(async () => {
    await TestDatabaseManager.connect();

    module = await Test.createTestingModule({
      providers: [
        UpdateUserStatusUseCase,
        {
          provide: PrismaService,
          useValue: TestDatabaseManager.getInstance(),
        },
        {
          provide: IUserRepository,
          useClass: PrismaUserRepository,
        },
        {
          provide: IAuditLogService,
          useClass: PrismaAuditLogService,
        },
      ],
    }).compile();

    updateUserStatusUseCase = module.get(UpdateUserStatusUseCase);
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

  it('should activate user correctly', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const targetUser = await factories.users.createInOrganization(
      authenticatedUser.organizationId,
      {
        isActive: false,
      },
    );

    const dto: UpdateUserStatusDto = {
      isActive: true,
    };

    const result = await updateUserStatusUseCase.execute(
      targetUser.id,
      dto,
      authenticatedUser,
    );

    expect(result).toBeDefined();
    expect(result.isActive).toBe(true);
  });

  it('should deactivate user correctly', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const targetUser = await factories.users.createInOrganization(
      authenticatedUser.organizationId,
      {
        isActive: true,
      },
    );

    const dto: UpdateUserStatusDto = {
      isActive: false,
    };

    const result = await updateUserStatusUseCase.execute(
      targetUser.id,
      dto,
      authenticatedUser,
    );

    expect(result).toBeDefined();
    expect(result.isActive).toBe(false);
  });

  it('should throw a not found exception when updating a non-existent user', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const dto: UpdateUserStatusDto = {
      isActive: true,
    };

    await expect(
      updateUserStatusUseCase.execute(ulid(), dto, authenticatedUser),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw a not found exception when updating user from another organization', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const authenticatedUserAnotherOrg =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const targetUser = await factories.users.createInOrganization(
      authenticatedUser.organizationId,
      {},
    );

    const dto: UpdateUserStatusDto = {
      isActive: true,
    };

    await expect(
      updateUserStatusUseCase.execute(
        targetUser.id,
        dto,
        authenticatedUserAnotherOrg,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
