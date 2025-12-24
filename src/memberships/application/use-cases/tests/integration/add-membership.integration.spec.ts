import { Test, TestingModule } from "@nestjs/testing"
import { AddMembershipUseCase } from "../../add-membership.use-case";
import { PrismaService } from "src/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { FindOrganizationUseCase } from "src/organizations/application/use-cases/find-organization.use-case";
import { IOrganizationRepository } from "src/organizations/domain/repositories/organization.repository.interface";
import { PrismaOrganizationRepository } from "src/organizations/infrastructure/persistence/prisma-organization.repository";
import { ConflictException } from "@nestjs/common";
import { AddMembershipDto } from "src/memberships/application/dtos/add-membership.dto";
import { IMembershipRepository } from "src/memberships/domain/contracts/membership.repository.interface";
import { PrismaMembershipRepository } from "src/memberships/infrastructure/persistence/prisma-membership.repository";

describe('AddMembershipUseCase - Integration', () => {
    let module: TestingModule;
    let addMembershipUseCase: AddMembershipUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                AddMembershipUseCase,
                FindOrganizationUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IMembershipRepository,
                    useClass: PrismaMembershipRepository
                },
                {
                    provide: IOrganizationRepository,
                    useClass: PrismaOrganizationRepository
                }
            ]
        }).compile();

        addMembershipUseCase = module.get(AddMembershipUseCase);
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

    it('should add membership correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const organization = await factories.organizations.create();

        const dto: AddMembershipDto = {
            organizationId: organization.id
        };

        const result = await addMembershipUseCase.execute(dto, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.userId).toBe(authenticatedUser.id);
        expect(result.organizationId).toBe(organization.id);
    });

    it('should throw conflict exception when membership already exists', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const organization = await factories.organizations.create();

        const dto: AddMembershipDto = {
            organizationId: organization.id
        };

        await addMembershipUseCase.execute(dto, authenticatedUser);

        await expect(addMembershipUseCase.execute(dto, authenticatedUser)).rejects.toThrow(ConflictException);
    });
})

