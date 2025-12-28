import { Test, TestingModule } from "@nestjs/testing"
import { ValidateUserEmailUseCase } from "../../validate-user-email.use-case";
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { PrismaUserRepository } from "src/account/infrastructure/repositories/prisma-user.repository";
import { IUserRepository } from "src/account/domain/interfaces/user.repository.interface";

describe('ValidateUserEmailUseCase - Integration', () => {
    let module: TestingModule;
    let validateUserEmailUseCase: ValidateUserEmailUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                ValidateUserEmailUseCase,
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

        validateUserEmailUseCase = module.get(ValidateUserEmailUseCase);
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

    it('should return user when email exists in organization', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();
        const targetUser = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId,
            email: 'test@example.com'
        });

        const result = await validateUserEmailUseCase.execute(targetUser.email, authenticatedUser);

        expect(result).toBeDefined();
        expect(result?.email).toBe(targetUser.email);
    });

    it('should return null when email does not exist', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const result = await validateUserEmailUseCase.execute('nonexistent@example.com', authenticatedUser);

        expect(result).toBeNull();
    });

    it('should return null when email exists in another organization', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();
        const authenticatedUserAnotherOrg = await factories.users.createAuthenticatedPhysicianProfessional();
        const targetUser = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId,
            email: 'test@example.com'
        });

        const result = await validateUserEmailUseCase.execute(targetUser.email, authenticatedUserAnotherOrg);

        expect(result).toBeNull();
    });
})

