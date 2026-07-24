import { Test, TestingModule } from "@nestjs/testing"
import { CreatePatientUseCase } from "../../create-patient.use-case";
import { PrismaService } from "src/infra/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { PatientRepository } from "src/patients/patient.repository";
import { PrismaPatientRepository } from "src/patients/prisma-patient.repository";
import { CreatePatientDto } from "src/patients/dtos/create-patient.dto";

describe('CreatePatientUseCase - Integration', () => {
    let module: TestingModule;
    let createPatientUseCase: CreatePatientUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                CreatePatientUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: PatientRepository,
                    useClass: PrismaPatientRepository
                }
            ]
        }).compile();

        createPatientUseCase = module.get(CreatePatientUseCase);
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

    it('should create patient correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const dto: CreatePatientDto = {
            fullName: 'João Silva',
            birthDate: new Date('1990-01-15'),
            weightInKg: 75.5,
            phoneNumber: '11987654321'
        };

        const result = await createPatientUseCase.execute(dto, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.fullName).toBe(dto.fullName);
        expect(result.weightInKg).toBe(dto.weightInKg);
        expect(result.phoneNumber).toBe(dto.phoneNumber);
        expect(result.organizationId).toBe(authenticatedUser.activeOrgId);
    });

    it('should create patient with correct created and updated by', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const dto: CreatePatientDto = {
            fullName: 'Maria Santos',
            birthDate: new Date('1985-05-20'),
            weightInKg: 65.0,
            phoneNumber: '11912345678'
        };

        const result = await createPatientUseCase.execute(dto, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.createdById).toBe(authenticatedUser.id);
        expect(result.updatedById).toBe(authenticatedUser.id);
    });
})


