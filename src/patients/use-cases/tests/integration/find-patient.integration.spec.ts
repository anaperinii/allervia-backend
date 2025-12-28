import { Test, TestingModule } from "@nestjs/testing"
import { FindPatientUseCase } from "../../find-patient.use-case";
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IPatientRepository } from "src/patients/domain/interfaces/patient.repository.interface";
import { PrismaPatientRepository } from "src/patients/infrastructure/persistence/prisma-patient.repository";
import { ulid } from "ulid";
import { PatientNotFoundException } from "src/patients/domain/exceptions/patient-not-found.exception";

describe('FindPatientUseCase - Integration', () => {
    let module: TestingModule;
    let findPatientUseCase: FindPatientUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                FindPatientUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IPatientRepository,
                    useClass: PrismaPatientRepository
                }
            ]
        }).compile();

        findPatientUseCase = module.get(FindPatientUseCase);
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

    it('should return the correct patient by id', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const patient = await factories.patients.create({
            primaryOrganizationId: authenticatedUser.activeOrgId,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id
        });

        const result = await findPatientUseCase.execute(patient.id, authenticatedUser.activeOrgId);

        expect(result).toBeDefined();
        expect(result.id).toBe(patient.id);
        expect(result.fullName).toBe(patient.fullName);
    });

    it('should throw a not found exception when querying a non-existent patient', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        await expect(findPatientUseCase.execute(ulid(), authenticatedUser.activeOrgId)).rejects.toThrow(PatientNotFoundException);
    });

    it('should throw a not found exception when querying with another organization id', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();
        const authenticatedUserAnotherOrg = await factories.users.createAuthenticatedPhysicianProfessional();

        const patient = await factories.patients.create({
            primaryOrganizationId: authenticatedUser.activeOrgId,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id
        });

        await expect(findPatientUseCase.execute(patient.id, authenticatedUserAnotherOrg.activeOrgId)).rejects.toThrow(PatientNotFoundException);
    });
})


