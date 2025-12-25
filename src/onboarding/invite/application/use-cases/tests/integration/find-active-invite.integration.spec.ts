import { Test, TestingModule } from "@nestjs/testing"
import { FindActiveInviteUseCase } from "../../find-active-invite.use-case";
import { PrismaService } from "src/database/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IUserInviteRepository } from "src/onboarding/invite/domain/contracts/user-invite.repository.interface";
import { PrismaUserInviteRepository } from "src/onboarding/invite/infrastructure/persistence/prisma-user-invite.repository";

describe('FindActiveInviteUseCase - Integration', () => {
    let module: TestingModule;
    let findActiveInviteUseCase: FindActiveInviteUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                FindActiveInviteUseCase,
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

        findActiveInviteUseCase = module.get(FindActiveInviteUseCase);
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

    it('should return active invite by email and organization', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const invite = await factories.internalUserInvite.create({
            email: 'test@example.com',
            organizationId: authenticatedUser.activeOrgId,
            isActive: true,
            expiresAt: new Date('2026-01-01'),
            createdById: authenticatedUser.id
        });

        const result = await findActiveInviteUseCase.execute(invite.email, authenticatedUser.activeOrgId);

        expect(result).toBeDefined();
        expect(result?.id).toBe(invite.id);
        expect(result?.email).toBe(invite.email);
    });

    it('should return null when no active invite exists', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const result = await findActiveInviteUseCase.execute('nonexistent@example.com', authenticatedUser.activeOrgId);

        expect(result).toBeNull();
    });

    it('should return null when invite is not active', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        await factories.internalUserInvite.create({
            email: 'test@example.com',
            organizationId: authenticatedUser.activeOrgId,
            isActive: false,
            expiresAt: new Date('2026-01-01'),
            createdById: authenticatedUser.id
        });

        const result = await findActiveInviteUseCase.execute('test@example.com', authenticatedUser.activeOrgId);

        expect(result).toBeNull();
    });
})

