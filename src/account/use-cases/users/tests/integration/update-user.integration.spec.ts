import { Test, TestingModule } from "@nestjs/testing"
import { UpdateUserUseCase } from "../../update-user.use-case";
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { PrismaUserRepository } from "src/account/prisma-user.repository";
import { ulid } from "ulid";
import { IPasswordHashingService } from "src/security/interfaces/password-hashing.service.interface";
import { BcryptPasswordHashingService } from "src/security/infrastructure/cryptography/bcrypt-password-hashing.service";
import { UserNotFoundException } from "src/account/exceptions/users/user-not-found.exception";
import { IUserRepository } from "src/account/user.repository";
import { UpdateUserPersonalDto } from "src/account/dtos/users/update-user-personal.dto";

describe('UpdateUserPersonalUseCase - Integration', () => {
    let module: TestingModule;
    let updateUserPersonalUseCase: UpdateUserUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                UpdateUserUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IUserRepository,
                    useClass: PrismaUserRepository
                },
                {
                    provide: IPasswordHashingService,
                    useClass: BcryptPasswordHashingService,
                },
            ]
        }).compile();

        updateUserPersonalUseCase = module.get(UpdateUserUseCase);
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

    it('should update user personal data correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const dto: UpdateUserPersonalDto = {
            fullName: 'Nome Atualizado',
            specialty: 'Cardiologia',
            phoneNumber: '11987654321'
        };

        console.log(authenticatedUser)

        const result = await updateUserPersonalUseCase.execute(authenticatedUser.id, dto, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.fullName).toBe(dto.fullName);
        console.log(result)
    });

    it('should update password correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const dto: UpdateUserPersonalDto = {
            password: 'newpassword123'
        };

        const result = await updateUserPersonalUseCase.execute(authenticatedUser.id, dto, authenticatedUser);

        expect(result).toBeDefined();
    });

    it('should throw a not found exception when updating a non-existent user', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const dto: UpdateUserPersonalDto = {
            fullName: 'Nome Atualizado'
        };

        await expect(updateUserPersonalUseCase.execute(ulid(), dto, authenticatedUser)).rejects.toThrow(UserNotFoundException);
    });
})

