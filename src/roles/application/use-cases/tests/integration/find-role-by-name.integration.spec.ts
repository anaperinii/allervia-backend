import { Test, TestingModule } from "@nestjs/testing"
import { FindRoleByNameUseCase } from "../../find-role-by-name.use-case";
import { PrismaService } from "src/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { RoleNotFoundException } from "src/roles/domain/exceptions/role-not-found.exception";
import { IRoleRepository } from "src/roles/domain/repositories/role.repository.interface";
import { PrismaRoleRepository } from "src/roles/infrastructure/persistence/prisma-role.repository";


describe('FindRoleByNameUseCase - Integration', () => {
    let module: TestingModule;
    let findRoleByNameUseCase: FindRoleByNameUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                FindRoleByNameUseCase,
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

        findRoleByNameUseCase = module.get(FindRoleByNameUseCase);
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

    it('should return role correctly by name', async () => {
        const organization = await factories.organizations.create();
        const role = await prisma.role.create({
            data: {
                name: 'PHYSICIAN',
                organizationId: organization.id,
                isActive: true
            }
        });

        const result = await findRoleByNameUseCase.execute('PHYSICIAN', organization.id);

        expect(result).toBeDefined();
        expect(result.id).toBe(role.id);
        expect(result.name).toBe(role.name);
    });
})

