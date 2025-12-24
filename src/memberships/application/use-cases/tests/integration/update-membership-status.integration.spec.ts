import { Test, TestingModule } from "@nestjs/testing"
import { UpdateMembershipStatusUseCase } from "../../update-membership-status.use-case";
import { PrismaService } from "src/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { ulid } from "ulid";
import { NotFoundException } from "@nestjs/common";
import { UpdateMembershipStatusDto } from "src/memberships/application/dtos/update-membership-status.dto";
import { IMembershipRepository } from "src/memberships/domain/contracts/membership.repository.interface";
import { PrismaMembershipRepository } from "src/memberships/infrastructure/persistence/prisma-membership.repository";

describe('UpdateMembershipStatusUseCase - Integration', () => {
    let module: TestingModule;
    let updateMembershipStatusUseCase: UpdateMembershipStatusUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                UpdateMembershipStatusUseCase,
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

        updateMembershipStatusUseCase = module.get(UpdateMembershipStatusUseCase);
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

    it('should update membership status correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const organization = await factories.organizations.create();
        const membership = await factories.memberships.create({
            userId: authenticatedUser.id,
            organizationId: organization.id,
            isActive: true
        });

        const dto: UpdateMembershipStatusDto = {
            isActive: false
        };

        const result = await updateMembershipStatusUseCase.execute(membership.id, dto);

        expect(result).toBeDefined();
        expect(result.isActive).toBeFalsy();
    });

    it('should throw not found exception when membership does not exist', async () => {
        const dto: UpdateMembershipStatusDto = {
            isActive: false
        };

        await expect(updateMembershipStatusUseCase.execute(ulid(), dto)).rejects.toThrow(NotFoundException);
    });
})

