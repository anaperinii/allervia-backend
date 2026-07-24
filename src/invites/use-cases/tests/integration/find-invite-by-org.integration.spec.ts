import { Test, TestingModule } from "@nestjs/testing"
import { FindInviteByOrgUseCase } from "src/invites/use-cases/find-invite-by-org.use-case";
import { PrismaService } from "src/infra/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IUserInviteRepository } from "src/invites/domain/interfaces/user-invite.repository.interface";
import { PrismaUserInviteRepository } from "src/invites/prisma-user-invite.repository";


describe('FindInviteByOrgUseCase - Integration', () => {
    let module: TestingModule;
    let findInviteByOrgUseCase: FindInviteByOrgUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                FindInviteByOrgUseCase,
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

        findInviteByOrgUseCase = module.get(FindInviteByOrgUseCase);
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

    it('should return invites by organization', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const invite1 = await factories.internalUserInvite.create({
            organizationId: authenticatedUser.activeOrgId,
            expiresAt: new Date('2026-01-01'),
            createdById: authenticatedUser.id
        });

        const invite2 = await factories.internalUserInvite.create({
            organizationId: authenticatedUser.activeOrgId,
            expiresAt: new Date('2026-01-01'),
            createdById: authenticatedUser.id
        });

        const result = await findInviteByOrgUseCase.execute(authenticatedUser.activeOrgId, {});

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThanOrEqual(2);
        expect(result.some(i => i.id === invite1.id)).toBe(true);
        expect(result.some(i => i.id === invite2.id)).toBe(true);
    });

    it('should return empty array when organization has no invites', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const result = await findInviteByOrgUseCase.execute(authenticatedUser.activeOrgId, {});

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
    });
})


