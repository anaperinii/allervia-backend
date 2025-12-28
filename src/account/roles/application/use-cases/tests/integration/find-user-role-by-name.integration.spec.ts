import { Test, TestingModule } from "@nestjs/testing"
import { FindUserRoleByNameUseCase } from "../../find-user-role-by-name.use-case";
import { PrismaService } from "src/database/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IRoleRepository } from "src/account/roles/domain/contracts/role.repository.interface";
import { PrismaRoleRepository } from "src/account/roles/infrastructure/persistence/prisma-role.repository";


describe('FindUserRoleByNameUseCase - Integration', () => {
    let module: TestingModule;
    let findUserRoleByNameUseCase: FindUserRoleByNameUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                FindUserRoleByNameUseCase,
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

        findUserRoleByNameUseCase = module.get(FindUserRoleByNameUseCase);
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

    it('should return user role correctly by name', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const targetUser = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId
        });

        await factories.roles.create({
            name: 'PHYSICIAN'
        });

        await prisma.userRole.create({
            data: {
                userId: targetUser.id,
                roleTag: 'PHYSICIAN'
            }
        });

        const result = await findUserRoleByNameUseCase.execute(targetUser.id, 'PHYSICIAN');

        expect(result).toBeDefined();
        expect(result?.userId).toBe(targetUser.id);
        expect(result?.roleTag).toBe('PHYSICIAN');
    });

    it('should return null when user does not have the role', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const targetUser = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId
        });

        await factories.roles.create({
            name: 'PHYSICIAN'
        });

        const result = await findUserRoleByNameUseCase.execute(targetUser.id, 'PHYSICIAN');

        expect(result).toBeNull();
    });
})

