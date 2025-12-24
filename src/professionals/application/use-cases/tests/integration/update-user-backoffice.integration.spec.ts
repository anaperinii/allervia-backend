import { Test, TestingModule } from "@nestjs/testing"
import { UpdateUserBackofficeUseCase } from "../../update-user-backoffice.use-case";
import { PrismaService } from "src/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IUserRepository } from "src/account/domain/contracts/user.repository.interface";
import { PrismaUserRepository } from "src/account/infrastructure/persistence/prisma-user.repository";
import { IProfessionalRepository } from "src/professionals/domain/professional.repository.interface";
import { ProfessionalPrismaRepository } from "src/professionals/infrastructure/persistence/prisma-professional.repository";
import { UpdateUserBackofficeDto } from "src/account/application/dtos/update-user-backoffice.dto";
import { ulid } from "ulid";
import { UserNotFoundException } from "src/account/domain/exceptions/user-not-found.exception";
import { NotFoundException } from "@nestjs/common";

describe('UpdateUserBackofficeUseCase - Integration', () => {
    let module: TestingModule;
    let updateUserBackofficeUseCase: UpdateUserBackofficeUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                UpdateUserBackofficeUseCase,
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
                }
            ]
        }).compile();

        updateUserBackofficeUseCase = module.get(UpdateUserBackofficeUseCase);
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

    it('should update user backoffice data correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        
        // Create a professional user in the same organization
        const user = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId,
            type: 'PROFESSIONAL'
        });
        const professional = await factories.professionals.create({
            userId: user.id
        });

        const dto: UpdateUserBackofficeDto = {
            fullName: 'Nome Atualizado',
            specialty: 'Cardiologia',
            phoneNumber: '11987654321'
        };

        const result = await updateUserBackofficeUseCase.execute(user.id, dto, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.fullName).toBe(dto.fullName);
        expect(result.professional).toBeDefined();
        expect(result.professional.specialty).toBe(dto.specialty);
        expect(result.professional.phoneNumber).toBe(dto.phoneNumber);
    });

    it('should update user partially', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        
        // Create a professional user in the same organization
        const user = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId,
            type: 'PROFESSIONAL'
        });
        await factories.professionals.create({
            userId: user.id
        });

        const dto: UpdateUserBackofficeDto = {
            fullName: 'Nome Atualizado'
        };

        const result = await updateUserBackofficeUseCase.execute(user.id, dto, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.fullName).toBe(dto.fullName);
    });

    it('should throw a not found exception when updating a non-existent user', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const dto: UpdateUserBackofficeDto = {
            fullName: 'Nome Atualizado'
        };

        await expect(updateUserBackofficeUseCase.execute(ulid(), dto, authenticatedUser)).rejects.toThrow(UserNotFoundException);
    });

    it('should throw not found exception when user is not a professional', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const nonProfessionalUser = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId,
            type: 'ADMIN'
        });

        const dto: UpdateUserBackofficeDto = {
            fullName: 'Nome Atualizado'
        };

        await expect(updateUserBackofficeUseCase.execute(nonProfessionalUser.id, dto, authenticatedUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw a not found exception when updating user from another organization', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const authenticatedUserAnotherOrg = await factories.users.createAuthenticatedAdmin();
        
        // Create a professional user in the first organization
        const user = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId,
            type: 'PROFESSIONAL'
        });
        await factories.professionals.create({
            userId: user.id
        });

        const dto: UpdateUserBackofficeDto = {
            fullName: 'Nome Atualizado'
        };

        await expect(updateUserBackofficeUseCase.execute(user.id, dto, authenticatedUserAnotherOrg)).rejects.toThrow(UserNotFoundException);
    });
})

