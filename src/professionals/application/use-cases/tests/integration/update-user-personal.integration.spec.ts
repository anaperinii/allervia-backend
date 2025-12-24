import { Test, TestingModule } from "@nestjs/testing"
import { UpdateUserPersonalUseCase } from "../../update-user-personal.use-case";
import { PrismaService } from "src/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IUserRepository } from "src/account/domain/contracts/user.repository.interface";
import { PrismaUserRepository } from "src/account/infrastructure/persistence/prisma-user.repository";
import { IProfessionalRepository } from "src/professionals/domain/professional.repository.interface";
import { ProfessionalPrismaRepository } from "src/professionals/infrastructure/persistence/prisma-professional.repository";
import { IHashingService } from "src/account/domain/contracts/hashing.service.interface";
import { BcryptService } from "src/account/infrastructure/cryptography/bcrypt.service";
import { UpdateUserPersonalDto } from "src/account/application/dtos/update-user-personal.dto";
import { ulid } from "ulid";
import { UserNotFoundException } from "src/account/domain/exceptions/user-not-found.exception";
import { NotFoundException } from "@nestjs/common";

describe('UpdateUserPersonalUseCase - Integration', () => {
    let module: TestingModule;
    let updateUserPersonalUseCase: UpdateUserPersonalUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                UpdateUserPersonalUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IUserRepository,
                    useClass: PrismaUserRepository
                },
                {
                    provide: IProfessionalRepository,
                    useClass: ProfessionalPrismaRepository
                },
                {
                    provide: IHashingService,
                    useClass: BcryptService
                }
            ]
        }).compile();

        updateUserPersonalUseCase = module.get(UpdateUserPersonalUseCase);
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

    it('should throw not found exception when user is not a professional', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const nonProfessionalUser = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId,
            type: 'ADMIN'
        });

        const dto: UpdateUserPersonalDto = {
            fullName: 'Nome Atualizado'
        };

        await expect(updateUserPersonalUseCase.execute(nonProfessionalUser.id, dto, authenticatedUser)).rejects.toThrow(NotFoundException);
    });
})

