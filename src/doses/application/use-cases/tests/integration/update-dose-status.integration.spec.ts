import { Test, TestingModule } from "@nestjs/testing"
import { PrismaService } from "src/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IDoseRepository } from "src/doses/domain/contracts/dose.repository.interface";
import { PrismaDoseRepository } from "src/doses/infrastructure/persistence/prisma-dose.repository";
import { ulid } from "ulid";
import { DoseNotFoundException } from "src/doses/domain/exceptions/dose-not-found.exception";
import { UpdateDoseUseCase } from "../../update-dose.use-case";

describe('UpdateDoseStatusUseCase - Integration', () => {
    let module: TestingModule;
    let updateDoseUseCase: UpdateDoseUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                UpdateDoseUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IDoseRepository,
                    useClass: PrismaDoseRepository
                }
            ]
        }).compile();

        updateDoseUseCase = module.get(UpdateDoseUseCase);
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

    it('should update correctly the respective dose', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const patient = await factories.patients.create({
            primaryOrganizationId: authenticatedUser.activeOrgId,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id
        });

        const immunotherapy = await factories.immunotherapies.create({
            inductionStartDate: new Date('2026-01-15'),
            responsiblePhysicianId: authenticatedUser.professionalId,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id,
            patientId: patient.id
        });

        const dose = await factories.doses.create({
            administeredAt: new Date('2026-01-16'),
            scheduledAt: new Date('2026-01-16'),
            immunotherapyId: immunotherapy.id,
            administeredById: authenticatedUser.professionalId,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id,
            status: 'ADMINISTERED'
        });

        console.log(dose)

        const dto = {
            notes: "Teste de Notas Update"
        }

        const result = await updateDoseUseCase.execute(dose.id, dto, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.notes).toEqual(dto.notes);
        console.log(result);
    });

    it('should throw a not found expection when passing a non-existent dose', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const patient = await factories.patients.create({
            primaryOrganizationId: authenticatedUser.activeOrgId,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id
        });

        const immunotherapy = await factories.immunotherapies.create({
            inductionStartDate: new Date('2026-01-15'),
            responsiblePhysicianId: authenticatedUser.professionalId,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id,
            patientId: patient.id
        });

        const dose = await factories.doses.create({
            administeredAt: new Date('2026-01-16'),
            scheduledAt: new Date('2026-01-16'),
            immunotherapyId: immunotherapy.id,
            administeredById: authenticatedUser.professionalId,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id
        });

        console.log(dose)

        const dto = {
            notes: "Teste de Notas Update"
        }

       await expect(updateDoseUseCase.execute(ulid(), dto, authenticatedUser)).rejects.toThrow(DoseNotFoundException);
    });
})