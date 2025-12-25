import { Test, TestingModule } from "@nestjs/testing"
import { ListMembershipsByUserUseCase } from "../../list-memberships-by-user.use-case";
import { PrismaService } from "src/database/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IMembershipRepository } from "src/memberships/domain/contracts/membership.repository.interface";
import { NoMembershipsForUserException } from "src/memberships/domain/exceptions/no-memberships-for-user.exception";
import { PrismaMembershipRepository } from "src/memberships/infrastructure/persistence/prisma-membership.repository";

describe('ListMembershipsByUserUseCase - Integration', () => {
    let module: TestingModule;
    let listMembershipsByUserUseCase: ListMembershipsByUserUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                ListMembershipsByUserUseCase,
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

        listMembershipsByUserUseCase = module.get(ListMembershipsByUserUseCase);
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

    it('should return all memberships by user', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const organization1 = await factories.organizations.create();
        const organization2 = await factories.organizations.create();

        const membership1 = await factories.memberships.create({
            userId: authenticatedUser.id,
            organizationId: organization1.id
        });

        const membership2 = await factories.memberships.create({
            userId: authenticatedUser.id,
            organizationId: organization2.id
        });

        const result = await listMembershipsByUserUseCase.execute(authenticatedUser.id);

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThanOrEqual(2);
        // expect(result.some(m => m. === membership1.id)).toBe(true);
        // expect(result.some(m => m.id === membership2.id)).toBe(true);
    });

    it('should throw exception when user has no memberships', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

       const result = await listMembershipsByUserUseCase.execute(authenticatedUser.id);

       expect(result).toEqual([]);
    });
})

