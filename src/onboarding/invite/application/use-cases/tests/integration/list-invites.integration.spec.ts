import { Test, TestingModule } from "@nestjs/testing"
import { ListInvitesUseCase } from "../../list-invites.use-case";
import { PrismaService } from "src/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { FindInviteByOrgUseCase } from "../../find-invite-by-org.use-case";
import { FindUserByIdUseCase } from "src/account/application/use-cases/find-user-by-id.use-case";
import { IUserRepository } from "src/account/domain/contracts/user.repository.interface";
import { PrismaUserRepository } from "src/account/infrastructure/persistence/prisma-user.repository";
import { IUserInviteRepository } from "src/onboarding/invite/domain/contracts/user-invite.repository.interface";
import { PrismaUserInviteRepository } from "src/onboarding/invite/infrastructure/persistence/prisma-user-invite.repository";
import { ListInvitesQueryDto } from "../../../dtos/list-invites-query.dto";

describe('ListInvitesUseCase - Integration', () => {
    let module: TestingModule;
    let listInvitesUseCase: ListInvitesUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                ListInvitesUseCase,
                FindInviteByOrgUseCase,
                FindUserByIdUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IUserInviteRepository,
                    useClass: PrismaUserInviteRepository
                },
                {
                    provide: IUserRepository,
                    useClass: PrismaUserRepository
                }
            ]
        }).compile();

        listInvitesUseCase = module.get(ListInvitesUseCase);
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

    it('should return all invites by organization', async () => {
        
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

        const query: ListInvitesQueryDto = {};

        const result = await listInvitesUseCase.execute(authenticatedUser, query);

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThanOrEqual(2);
        expect(result.some(i => i.id === invite1.id)).toBe(true);
        expect(result.some(i => i.id === invite2.id)).toBe(true);
    });

    it('should return empty array when organization has no invites', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const query: ListInvitesQueryDto = {};

        const result = await listInvitesUseCase.execute(authenticatedUser, query);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
    });
})

