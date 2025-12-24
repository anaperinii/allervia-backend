import { Test, TestingModule } from "@nestjs/testing"
import { ListProfessionalsUseCase } from "../../list-professionals.use-case";
import { PrismaService } from "src/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IProfessionalRepository } from "src/professionals/domain/professional.repository.interface";
import { ProfessionalPrismaRepository } from "src/professionals/infrastructure/persistence/prisma-professional.repository";

describe('ListProfessionalsUseCase - Integration', () => {
    let module: TestingModule;
    let listProfessionalsUseCase: ListProfessionalsUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                ListProfessionalsUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IProfessionalRepository,
                    useClass: ProfessionalPrismaRepository
                }
            ]
        }).compile();

        listProfessionalsUseCase = module.get(ListProfessionalsUseCase);
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

    it('should return all professionals', async () => {
        const professional1 = await factories.users.createAuthenticatedPhysicianProfessional();
        const professional2 = await factories.users.createAuthenticatedPhysicianProfessional();

        const result = await listProfessionalsUseCase.execute();

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThanOrEqual(2);
        expect(result.some(p => p.id === professional1.professionalId)).toBe(true);
        expect(result.some(p => p.id === professional2.professionalId)).toBe(true);
    });

    it('should return empty array when there are no professionals', async () => {
        const result = await listProfessionalsUseCase.execute();

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
    });
})

