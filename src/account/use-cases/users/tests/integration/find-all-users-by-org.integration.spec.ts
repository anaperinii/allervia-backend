import { Test, TestingModule } from "@nestjs/testing";
import { FindAllUsersByOrganizationUseCase } from "../../find-all-users-by-organization.use-case";
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { PrismaUserRepository } from "src/account/infrastructure/repositories/prisma-user.repository";
import { IUserRepository } from "src/account/domain/interfaces/user.repository.interface";

describe('FindAllUsersByOrganizationUseCase - Integration', () => {
    let module: TestingModule;
    let findAllUsersByOrgUseCase: FindAllUsersByOrganizationUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                FindAllUsersByOrganizationUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IUserRepository,
                    useClass: PrismaUserRepository
                }
            ]
        }).compile();

        findAllUsersByOrgUseCase = module.get(FindAllUsersByOrganizationUseCase);
        prisma = module.get(PrismaService);
        factories = new TestFactories(prisma);
    });

    beforeEach(async () => {
        await TestDatabaseManager.cleanAll()
    });

    afterAll(async () => {
        if(module) {
            await module.close();
        }
        await TestDatabaseManager.disconnect();
    });

    it('should list all users by organization correctly', async () => {

        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        await factories.users.createMany( 8, {
            organizationId: authenticatedUser.activeOrgId,
            specialty: 'Alergia e Imunologia',
            phoneNumber: '62995574122',
        });

        const result = await findAllUsersByOrgUseCase.execute(authenticatedUser);

        expect(result).toBeDefined();
        expect(result.every((u) => u.organizationId === authenticatedUser.activeOrgId)).toBeTruthy();
        console.log(result);
    });

    it('should return a list containing only the authenticated user by querying in another organization id', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const authenticatedUserAnotherOrg = await factories.users.createAuthenticatedAdmin();

        await factories.users.createMany( 8, {
            organizationId: authenticatedUser.activeOrgId,
            specialty: 'Alergia e Imunologia',
            phoneNumber: '62995574122',
        });

        const result = await findAllUsersByOrgUseCase.execute(authenticatedUserAnotherOrg);

        expect(result.length).toEqual(1);
    });
});