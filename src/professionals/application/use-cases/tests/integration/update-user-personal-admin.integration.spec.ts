import { Test, TestingModule } from "@nestjs/testing"
import { UpdateUserPersonalAdminUseCase } from "../../update-user-personal-admin.use-case";
import { PrismaService } from "src/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IUserRepository } from "src/account/domain/contracts/user.repository.interface";
import { PrismaUserRepository } from "src/account/infrastructure/persistence/prisma-user.repository";
import { IHashingService } from "src/account/domain/contracts/hashing.service.interface";
import { BcryptService } from "src/account/infrastructure/cryptography/bcrypt.service";
import { UpdateUserAdminDto } from "src/account/application/dtos/update-user-admin.dto";
import { ulid } from "ulid";
import { UserNotFoundException } from "src/account/domain/exceptions/user-not-found.exception";

describe('UpdateUserPersonalAdminUseCase - Integration', () => {
    let module: TestingModule;
    let updateUserPersonalAdminUseCase: UpdateUserPersonalAdminUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                UpdateUserPersonalAdminUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IUserRepository,
                    useClass: PrismaUserRepository
                },
                {
                    provide: IHashingService,
                    useClass: BcryptService
                }
            ]
        }).compile();

        updateUserPersonalAdminUseCase = module.get(UpdateUserPersonalAdminUseCase);
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

    it('should update user admin data correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const targetUser = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId
        });

        const dto: UpdateUserAdminDto = {
            fullName: 'Nome Atualizado',
            email: 'novoemail@test.com'
        };

        const result = await updateUserPersonalAdminUseCase.execute(targetUser.id, dto, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.fullName).toBe(dto.fullName);
        expect(result.email).toBe(dto.email);
    });

    it('should update password correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const targetUser = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId
        });

        const dto: UpdateUserAdminDto = {
            password: 'newpassword123'
        };

        const result = await updateUserPersonalAdminUseCase.execute(targetUser.id, dto, authenticatedUser);

        expect(result).toBeDefined();
    });

    it('should update user partially', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const targetUser = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId
        });

        const dto: UpdateUserAdminDto = {
            fullName: 'Nome Atualizado'
        };

        const result = await updateUserPersonalAdminUseCase.execute(targetUser.id, dto, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.fullName).toBe(dto.fullName);
    });

    it('should throw a not found exception when updating a non-existent user', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const dto: UpdateUserAdminDto = {
            fullName: 'Nome Atualizado'
        };

        await expect(updateUserPersonalAdminUseCase.execute(ulid(), dto, authenticatedUser)).rejects.toThrow(UserNotFoundException);
    });

    it('should throw a not found exception when updating user from another organization', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const authenticatedUserAnotherOrg = await factories.users.createAuthenticatedAdmin();
        const targetUser = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId
        });

        const dto: UpdateUserAdminDto = {
            fullName: 'Nome Atualizado'
        };

        await expect(updateUserPersonalAdminUseCase.execute(targetUser.id, dto, authenticatedUserAnotherOrg)).rejects.toThrow(UserNotFoundException);
    });
})

