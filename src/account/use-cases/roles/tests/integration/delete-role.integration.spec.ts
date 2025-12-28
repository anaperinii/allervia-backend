import { Test, TestingModule } from "@nestjs/testing"
import { DeleteRoleUseCase } from "../../delete-role.use-case";
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { RoleInUseException } from "src/account/domain/exceptions/roles/role-in-use.exception";
import { IRoleRepository } from "src/account/domain/interfaces/role.repository.interface";
import { PrismaRoleRepository } from "src/account/roles/infrastructure/persistence/prisma-role.repository";
import { FindRoleByNameUseCase } from "../../find-role-by-name.use-case";


describe('DeleteRoleUseCase - Integration', () => {
    let module: TestingModule;
    let deleteRoleUseCase: DeleteRoleUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                DeleteRoleUseCase,
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

        deleteRoleUseCase = module.get(DeleteRoleUseCase);
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

    it('should deactivate role correctly', async () => {
        const organization = await factories.organizations.create();
        await prisma.role.create({
            data: {
                name: 'PHYSICIAN',
                organizationId: organization.id,
                isActive: false
            }
        });

        await deleteRoleUseCase.execute('PHYSICIAN', organization.id);

        const role = await prisma.role.findFirst({
            where: {
                name: 'PHYSICIAN',
                organizationId: organization.id
            }
        });

        expect(role?.isActive).toBe(false);
    });

    it('should throw exception when role is active', async () => {
        const organization = await factories.organizations.create();
        await prisma.role.create({
            data: {
                name: 'PHYSICIAN',
                organizationId: organization.id,
                isActive: true
            }
        });

        await expect(deleteRoleUseCase.execute('PHYSICIAN', organization.id)).rejects.toThrow(RoleInUseException);
    });
})

