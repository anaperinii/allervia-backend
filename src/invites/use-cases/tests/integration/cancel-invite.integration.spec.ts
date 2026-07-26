import { Test, TestingModule } from '@nestjs/testing';
import { CancelInviteUseCase } from 'src/invites/use-cases/cancel-invite.use-case';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestFactories } from 'test/factories';
import { TestDatabaseManager } from 'test/database/test-database.manager';

import { FindInviteByIdUseCase } from 'src/invites/use-cases/find-invite-by-id.use-case';
import { ulid } from 'ulid';
import { IUserInviteRepository } from 'src/invites/domain/interfaces/user-invite.repository.interface';
import { NotFoundException } from '@nestjs/common';
import { PrismaUserInviteRepository } from 'src/invites/prisma-user-invite.repository';

describe('CancelInviteUseCase - Integration', () => {
  let module: TestingModule;
  let cancelInviteUseCase: CancelInviteUseCase;
  let prisma: PrismaService;
  let factories: TestFactories;

  beforeAll(async () => {
    await TestDatabaseManager.connect();

    module = await Test.createTestingModule({
      providers: [
        CancelInviteUseCase,
        FindInviteByIdUseCase,
        {
          provide: PrismaService,
          useValue: TestDatabaseManager.getInstance(),
        },
        {
          provide: IUserInviteRepository,
          useClass: PrismaUserInviteRepository,
        },
      ],
    }).compile();

    cancelInviteUseCase = module.get(CancelInviteUseCase);
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

  it('should cancel invite correctly', async () => {
    const authenticatedUser = await factories.users.createAuthenticatedAdmin();

    const invite = await factories.internalUserInvite.create({
      organizationId: authenticatedUser.organizationId,
      isActive: true,
      expiresAt: new Date('2026-01-01'),
      createdById: authenticatedUser.id,
    });

    const result = await cancelInviteUseCase.execute(
      invite.id,
      authenticatedUser,
    );

    expect(result).toBeDefined();
    expect(result.isActive).toBe(false);
  });

  it('should throw not found exception when invite does not exist', async () => {
    const authenticatedUser = await factories.users.createAuthenticatedAdmin();

    await expect(
      cancelInviteUseCase.execute(ulid(), authenticatedUser),
    ).rejects.toThrow(NotFoundException);
  });
});
