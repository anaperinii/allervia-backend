import { Test, TestingModule } from "@nestjs/testing"
import { UpdateUserStatusUseCase } from "../../update-user-status.use-case";
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { PrismaUserRepository } from "src/account/prisma-user.repository";
import { ulid } from "ulid";
import { UserNotFoundException } from "src/account/exceptions/users/user-not-found.exception";
import { IUserRepository } from "src/account/user.repository";
import { UpdateUserStatusDto } from "src/account/dtos/users/update-user-status.dto";


describe('UpdateUserStatusUseCase - Integration', () => {
    let module: TestingModule;
    let updateUserStatusUseCase: UpdateUserStatusUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                UpdateUserStatusUseCase,
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

        updateUserStatusUseCase = module.get(UpdateUserStatusUseCase);
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

    it('should activate user correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();
        const targetUser = await factories.users.create({
            isActive: false
        });

        const dto: UpdateUserStatusDto = {
            isActive: true
        };

        const result = await updateUserStatusUseCase.execute(targetUser.id, dto, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.isActive).toBe(true);
    });

    it('should deactivate user correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();
        const targetUser = await factories.users.create({
            isActive: true
        });

        const dto: UpdateUserStatusDto = {
            isActive: false
        };

        const result = await updateUserStatusUseCase.execute(targetUser.id, dto, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.isActive).toBe(false);
    });

    it('should throw a not found exception when updating a non-existent user', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const dto: UpdateUserStatusDto = {
            isActive: true
        };

        await expect(updateUserStatusUseCase.execute(ulid(), dto, authenticatedUser)).rejects.toThrow(UserNotFoundException);
    });

    it('should throw a not found exception when updating user from another organization', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();
        const authenticatedUserAnotherOrg = await factories.users.createAuthenticatedPhysicianProfessional();
        const targetUser = await factories.users.create({});

        const dto: UpdateUserStatusDto = {
            isActive: true
        };

        await expect(updateUserStatusUseCase.execute(targetUser.id, dto, authenticatedUserAnotherOrg)).rejects.toThrow(UserNotFoundException);
    });
})

