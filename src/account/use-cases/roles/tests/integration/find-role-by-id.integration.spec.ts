import { Test, TestingModule } from "@nestjs/testing"
import { FindRoleByIdUseCase } from "../../find-role-by-id.use-case";
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { RoleNotFoundException } from "src/account/exceptions/roles/role-not-found.exception";
import { IRoleRepository } from "src/account/role.repository";
import { PrismaRoleRepository } from "src/account/prisma-role.repository";
import { ulid } from "ulid";


describe('FindRoleByIdUseCase - Integration', () => {
    let module: TestingModule;
    let findRoleByIdUseCase: FindRoleByIdUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                FindRoleByIdUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IRoleRepository,
                    useClass: PrismaRoleRepository
                }
            ]
        }).compile();

        findRoleByIdUseCase = module.get(FindRoleByIdUseCase);
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

    it('should return role correctly by id', async () => {
        const organization = await factories.organizations.create();
        const role = await prisma.role.create({
            data: {
                name: 'PHYSICIAN',
                organizationId: organization.id,
                isActive: true
            }
        });

        const result = await findRoleByIdUseCase.execute(role.id, organization.id);

        expect(result).toBeDefined();
        expect(result.id).toBe(role.id);
        expect(result.name).toBe(role.name);
    });

    it('should throw not found exception when role does not exist', async () => {
        const organization = await factories.organizations.create();

        await expect(findRoleByIdUseCase.execute(ulid(), organization.id)).rejects.toThrow(RoleNotFoundException);
    });
})

