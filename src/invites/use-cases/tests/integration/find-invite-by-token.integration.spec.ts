import { Test, TestingModule } from "@nestjs/testing"
import { FindInviteByTokenUseCase } from "src/invites/use-cases/find-invite-by-token.use-case";
import { PrismaService } from "src/infra/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IUserInviteRepository } from "src/invites/domain/interfaces/user-invite.repository.interface";
import { NotFoundException } from "@nestjs/common";
import { PrismaUserInviteRepository } from "src/invites/prisma-user-invite.repository";


describe('FindInviteByTokenUseCase - Integration', () => {
    let module: TestingModule;
    let findInviteByTokenUseCase: FindInviteByTokenUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                FindInviteByTokenUseCase,
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

        findInviteByTokenUseCase = module.get(FindInviteByTokenUseCase);
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

    it('should return invite correctly by token', async () => {

        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const invite = await factories.internalUserInvite.create({
            token: 'test-token-123',
            expiresAt: new Date('2026-01-01'),
            organizationId: authenticatedUser.activeOrgId,
            createdById: authenticatedUser.id
        });

        const result = await findInviteByTokenUseCase.execute(invite.token);

        expect(result).toBeDefined();
        expect(result.id).toBe(invite.id);
        expect(result.token).toBe(invite.token);
    });

    it('should throw not found exception when invite does not exist', async () => {
        await expect(findInviteByTokenUseCase.execute('non-existent-token')).rejects.toThrow(NotFoundException);
    });
})


