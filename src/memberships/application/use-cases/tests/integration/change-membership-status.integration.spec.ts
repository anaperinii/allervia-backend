import { Test, TestingModule } from "@nestjs/testing"
import { ChangeMembershipStatusUseCase } from "../../change-membership-status.use-case";
import { PrismaService } from "src/database/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IMembershipRepository } from "src/memberships/domain/contracts/membership.repository.interface";
import { PrismaMembershipRepository } from "src/memberships/infrastructure/persistence/prisma-membership.repository";
import { NoMembershipsForUserException } from "src/memberships/domain/exceptions/no-memberships-for-user.exception";

describe('ChangeMembershipStatusUseCase - Integration', () => {
    let module: TestingModule;
    let changeMembershipStatusUseCase: ChangeMembershipStatusUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                ChangeMembershipStatusUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IMembershipRepository,
                    useClass: PrismaMembershipRepository
                }
            ]
        }).compile();

        changeMembershipStatusUseCase = module.get(ChangeMembershipStatusUseCase);
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

    it('should deactivate membership correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const organization = await factories.organizations.create();
        await factories.memberships.create({
            userId: authenticatedUser.id,
            organizationId: organization.id,
            isActive: true
        });

        const result = await changeMembershipStatusUseCase.execute(authenticatedUser, organization.id);

        expect(result).toBeDefined();
        expect(result.isActive).toBe(false);
    });

    it('should activate membership correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const organization = await factories.organizations.create();
        await factories.memberships.create({
            userId: authenticatedUser.id,
            organizationId: organization.id,
            isActive: false
        });

        const result = await changeMembershipStatusUseCase.execute(authenticatedUser, organization.id);

        expect(result).toBeDefined();
        expect(result.isActive).toBe(true);
    });

    it('should throw exception when membership does not exist', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const organization = await factories.organizations.create();

        await expect(changeMembershipStatusUseCase.execute(authenticatedUser, organization.id)).rejects.toThrow(NoMembershipsForUserException);
    });
})


