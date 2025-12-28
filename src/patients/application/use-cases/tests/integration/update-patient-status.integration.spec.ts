import { Test, TestingModule } from "@nestjs/testing"
import { UpdatePatientStatusUseCase } from "../../update-patient-status.use-case";
import { PrismaService } from "src/database/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IPatientRepository } from "src/patients/domain/contracts/patient.repository.interface";
import { PrismaPatientRepository } from "src/patients/infrastructure/persistence/prisma-patient.repository";
import { ulid } from "ulid";
import { PatientNotFoundException } from "src/patients/domain/exceptions/patient-not-found.exception";
import { UpdatePatientStatusDto } from "src/patients/application/dtos/update-patient-status.dto";

describe('UpdatePatientStatusUseCase - Integration', () => {
    let module: TestingModule;
    let updatePatientStatusUseCase: UpdatePatientStatusUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                UpdatePatientStatusUseCase,
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

        updatePatientStatusUseCase = module.get(UpdatePatientStatusUseCase);
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

    it('should activate patient correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const patient = await factories.patients.create({
            primaryOrganizationId: authenticatedUser.activeOrgId,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id,
            isActive: false
        });

        const dto: UpdatePatientStatusDto = {
            status: true
        };

        console.log(patient)

        const result = await updatePatientStatusUseCase.execute(patient.id, dto, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.isActive).toBeTruthy();
    });

    it('should deactivate patient correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const patient = await factories.patients.create({
            primaryOrganizationId: authenticatedUser.activeOrgId,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id,
            isActive: true
        });

        const dto: UpdatePatientStatusDto = {
            status: false
        };

        const result = await updatePatientStatusUseCase.execute(patient.id, dto, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.isActive).toBeFalsy();
    });

    it('should throw a not found exception when updating status of a non-existent patient', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const dto: UpdatePatientStatusDto = {
            status: true
        };

        await expect(updatePatientStatusUseCase.execute(ulid(), dto, authenticatedUser)).rejects.toThrow(PatientNotFoundException);
    });

    it('should throw a not found exception when updating patient status from another organization', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();
        const authenticatedUserAnotherOrg = await factories.users.createAuthenticatedPhysicianProfessional();

        const patient = await factories.patients.create({
            primaryOrganizationId: authenticatedUser.activeOrgId,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id
        });

        const dto: UpdatePatientStatusDto = {
            status: true
        };

        await expect(updatePatientStatusUseCase.execute(patient.id, dto, authenticatedUserAnotherOrg)).rejects.toThrow(PatientNotFoundException);
    });
})


