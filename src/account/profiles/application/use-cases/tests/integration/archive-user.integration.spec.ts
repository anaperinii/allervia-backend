import { Test, TestingModule } from "@nestjs/testing"
import { ArchiveUserUseCase } from "../../archive-user.use-case";
import { PrismaService } from "src/database/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IUserRepository } from "src/account/profiles/domain/contracts/user.repository.interface";
import { PrismaUserRepository } from "src/account/profiles/infrastructure/persistence/prisma-user.repository";
import { ulid } from "ulid";
import { UserNotFoundException } from "src/account/profiles/domain/exceptions/user-not-found.exception";

describe('ArchiveUserUseCase - Integration', () => {
    let module: TestingModule;
    let archiveUserUseCase: ArchiveUserUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                ArchiveUserUseCase,
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

        archiveUserUseCase = module.get(ArchiveUserUseCase);
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

    it('should archive user correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();
        const targetUser = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId
        });

        const result = await archiveUserUseCase.execute(targetUser.id, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.isArchived).toBe(true);
    });

    it('should throw a not found exception when archiving a non-existent user', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        await expect(archiveUserUseCase.execute(ulid(), authenticatedUser)).rejects.toThrow(UserNotFoundException);
    });

    it('should throw a not found exception when archiving user from another organization', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();
        const authenticatedUserAnotherOrg = await factories.users.createAuthenticatedPhysicianProfessional();
        const targetUser = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId
        });

        await expect(archiveUserUseCase.execute(targetUser.id, authenticatedUserAnotherOrg)).rejects.toThrow(UserNotFoundException);
    });
})

