import { Test, TestingModule } from "@nestjs/testing"
import { CancelInviteUseCase } from "../../cancel-invite.use-case";
import { PrismaService } from "src/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";

import { FindInviteByIdUseCase } from "../../find-invite-by-id.use-case";
import { ulid } from "ulid";
import { IUserInviteRepository } from "src/onboarding/invite/domain/contracts/user-invite.repository.interface";
import { UserInviteNotFoundException } from "src/onboarding/invite/domain/exceptions/user-invite-not-found.exception";
import { PrismaUserInviteRepository } from "src/onboarding/invite/infrastructure/persistence/prisma-user-invite.repository";


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
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IUserInviteRepository,
                    useClass: PrismaUserInviteRepository
                }
            ]
        }).compile();

        cancelInviteUseCase = module.get(CancelInviteUseCase);
        prisma = module.get(PrismaService);
        factories = new TestFactories(prisma);
    });

    beforeEach(async () => {
        await TestDatabaseManager.cleanAll();
    });

    afterAll(async () => {
        if(module) {
            await module.close();
        }
        await TestDatabaseManager.disconnect();
    });

    it('should cancel invite correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const invite = await factories.internalUserInvite.create({
            organizationId: authenticatedUser.activeOrgId,
            isActive: true,
            expiresAt: new Date('2026-01-01')
        });

        const result = await cancelInviteUseCase.execute(invite.id, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.isActive).toBe(false);
    });

    it('should throw not found exception when invite does not exist', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        await expect(cancelInviteUseCase.execute(ulid(), authenticatedUser)).rejects.toThrow(UserInviteNotFoundException);
    });
})

