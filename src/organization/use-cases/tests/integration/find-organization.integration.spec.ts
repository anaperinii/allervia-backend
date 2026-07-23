import { Test, TestingModule } from "@nestjs/testing"
import { FindOrganizationUseCase } from "../../find-organization.use-case";
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { NotFoundException } from "@nestjs/common";
import { OrganizationRepository } from "src/organization/organization.repository";
import { PrismaOrganizationRepository } from "src/organization/prisma-organization.repository";
import { ulid } from "ulid";

describe('FindOrganizationUseCase - Integration', () => {
    let module: TestingModule;
    let findOrganizationUseCase: FindOrganizationUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                FindOrganizationUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: OrganizationRepository,
                    useClass: PrismaOrganizationRepository
                }
            ]
        }).compile();

        findOrganizationUseCase = module.get(FindOrganizationUseCase);
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

    it('should return organization correctly by id', async () => {
        const organization = await factories.organizations.create();

        const result = await findOrganizationUseCase.execute(organization.id);

        expect(result).toBeDefined();
        expect(result.id).toBe(organization.id);
        expect(result.name).toBe(organization.name);
    });

    it('should throw not found exception when organization does not exist', async () => {
        await expect(findOrganizationUseCase.execute(ulid())).rejects.toThrow(NotFoundException);
    });
})


