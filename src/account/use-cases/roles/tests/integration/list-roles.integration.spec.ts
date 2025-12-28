import { Test, TestingModule } from "@nestjs/testing"
import { ListRolesUseCase } from "../../../../roles/use-cases/list-roles.use-case";
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IRoleRepository } from "src/account/domain/interfaces/role.repository.interface";
import { PrismaRoleRepository } from "src/account/roles/infrastructure/persistence/prisma-role.repository";

describe('ListRolesUseCase - Integration', () => {
    let module: TestingModule;
    let listRolesUseCase: ListRolesUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                ListRolesUseCase,
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

        listRolesUseCase = module.get(ListRolesUseCase);
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

    it('should return all active roles by organization', async () => {
        const organization = await factories.organizations.create();

        const role1 = await prisma.role.create({
            data: {
                name: 'PHYSICIAN',
                organizationId: organization.id,
                isActive: true
            }
        });

        const role2 = await prisma.role.create({
            data: {
                name: 'ADMIN',
                organizationId: organization.id,
                isActive: true
            }
        });

        const result = await listRolesUseCase.execute(organization.id);

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThanOrEqual(2);
        expect(result.some(r => r.id === role1.id)).toBe(true);
        expect(result.some(r => r.id === role2.id)).toBe(true);
    });

    it('should return empty array when organization has no active roles', async () => {
        const organization = await factories.organizations.create();

        const result = await listRolesUseCase.execute(organization.id);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
    });
})

