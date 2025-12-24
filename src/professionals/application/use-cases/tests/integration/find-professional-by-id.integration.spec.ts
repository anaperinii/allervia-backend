import { Test, TestingModule } from "@nestjs/testing"
import { FindProfessionalByIdUseCase } from "../../find-professional-by-id.use-case";
import { PrismaService } from "src/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IProfessionalRepository } from "src/professionals/domain/professional.repository.interface";
import { ProfessionalPrismaRepository } from "src/professionals/infrastructure/persistence/prisma-professional.repository";
import { FindUserByIdUseCase } from "src/account/application/use-cases/find-user-by-id.use-case";
import { IUserRepository } from "src/account/domain/contracts/user.repository.interface";
import { PrismaUserRepository } from "src/account/infrastructure/persistence/prisma-user.repository";
import { ulid } from "ulid";
import { ProfessionalNotFoundException } from "src/professionals/domain/exceptions/professional-not-found.exception";

describe('FindProfessionalByIdUseCase - Integration', () => {
    let module: TestingModule;
    let findProfessionalByIdUseCase: FindProfessionalByIdUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                FindProfessionalByIdUseCase,
                FindUserByIdUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IProfessionalRepository,
                    useClass: ProfessionalPrismaRepository
                },
                {
                    provide: IUserRepository,
                    useClass: PrismaUserRepository
                }
            ]
        }).compile();

        findProfessionalByIdUseCase = module.get(FindProfessionalByIdUseCase);
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

    it('should return the professional correctly by id', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const result = await findProfessionalByIdUseCase.execute(authenticatedUser.professionalId!, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.professional).toBeDefined();
        expect(result.professional.id).toBe(authenticatedUser.professionalId);
        expect(result.userData).toBeDefined();
        expect(result.userData.email).toBe(authenticatedUser.email);
    });

    it('should throw a not found exception when querying a non-existent professional', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        await expect(findProfessionalByIdUseCase.execute(ulid(), authenticatedUser)).rejects.toThrow(ProfessionalNotFoundException);
    });

    it('should throw a not found exception when querying professional from another organization', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();
        
        const authenticatedUserAnotherOrg = await factories.users.createAuthenticatedPhysicianProfessional();

        await expect(findProfessionalByIdUseCase.execute(authenticatedUser.professionalId!, authenticatedUserAnotherOrg)).rejects.toThrow(ProfessionalNotFoundException);
    });
})

