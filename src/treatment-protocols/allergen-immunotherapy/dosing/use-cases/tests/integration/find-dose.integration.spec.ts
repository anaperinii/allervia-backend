import { Test, TestingModule } from "@nestjs/testing"
import { PrismaService } from "src/infra/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IDoseRepository } from "src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface";
import { PrismaDoseRepository } from "src/treatment-protocols/allergen-immunotherapy/dosing/prisma-dose.repository";
import { FindDoseUseCase } from "../../find-dose.use-case";
import { ulid } from "ulid";
import { NotFoundException } from "@nestjs/common";

describe('FindDoseUseCase - Integration', () => {
    let module: TestingModule;
    let findDoseUseCase: FindDoseUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                FindDoseUseCase,
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

        findDoseUseCase = module.get(FindDoseUseCase);
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

    it('should return the correct dose by id', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const patient = await factories.patients.create({
            organizationId: authenticatedUser.activeOrgId,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id
        });

        const immunotherapy = await factories.immunotherapies.create({
            inductionStartDate: new Date('2026-01-15'),
            responsiblePhysicianId: authenticatedUser.id,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id,
            patientId: patient.id
        });

        const dose = await factories.doses.create({
            administeredAt: new Date('2026-01-16'),
            scheduledAt: new Date('2026-01-16'),
            immunotherapyId: immunotherapy.id,
            administeredById: authenticatedUser.id,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id
        });

        console.log(dose)

        const result = await findDoseUseCase.execute(dose.id, authenticatedUser.activeOrgId);

        expect(result).toBeDefined();
        console.log(result);
        expect(result.immunotherapyId).toBe(immunotherapy.id);
    });

    it('should throw a not found exception when querying a non-existent dose', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        await expect(findDoseUseCase.execute(ulid(), authenticatedUser.activeOrgId)).rejects.toThrow(NotFoundException);
        
    });

    it('should throw a not found exception when querying with another organization id', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const authenticatedUserAnotherOrg = await factories.users.createAuthenticatedPhysicianProfessional();

        const patient = await factories.patients.create({
            organizationId: authenticatedUser.activeOrgId,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id
        });

        const immunotherapy = await factories.immunotherapies.create({
            inductionStartDate: new Date('2026-01-15'),
            responsiblePhysicianId: authenticatedUser.id,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id,
            patientId: patient.id
        });

        const dose = await factories.doses.create({
            administeredAt: new Date('2026-01-16'),
            scheduledAt: new Date('2026-01-16'),
            immunotherapyId: immunotherapy.id,
            administeredById: authenticatedUser.id,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id
        });

        await expect(findDoseUseCase.execute(dose.id, authenticatedUserAnotherOrg.activeOrgId)).rejects.toThrow(NotFoundException);
    });
})