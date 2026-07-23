import { Test, TestingModule } from "@nestjs/testing"
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IDoseRepository } from "src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface";
import { PrismaDoseRepository } from "src/treatment-protocols/allergen-immunotherapy/dosing/prisma-dose.repository";
import { ListDosesByTherapyUseCase } from "../../list-doses-by-therapy.use-case";

describe('ListDosesByImmunotherapy - Integration', () => {
    let module: TestingModule;
    let listDosesByTherapyUseCase: ListDosesByTherapyUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                ListDosesByTherapyUseCase,
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

        listDosesByTherapyUseCase = module.get(ListDosesByTherapyUseCase);
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

    it('should return the correct doses for the respective immunotherapy', async () => {
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

        const doses = await factories.doses.createMany(5, {
            administeredAt: new Date('2026-01-16'),
            scheduledAt: new Date('2026-01-16'),
            immunotherapyId: immunotherapy.id,
            administeredById: authenticatedUser.id,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id 
        });

        console.log(doses)

        const result = await listDosesByTherapyUseCase.execute(immunotherapy.id, authenticatedUser.activeOrgId);

        expect(result).toBeDefined();
        console.log(result);
        expect(result.every(dose => dose.immunotherapyId === immunotherapy.id)).toBe(true);
    });

    it('should return an empty list when immunotherapy doesnt have any doses yet', async () => {
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

        const result = await listDosesByTherapyUseCase.execute(immunotherapy.id, authenticatedUser.activeOrgId);

        expect(result).toEqual([]);
    });

    it('should return an empty list when querying with another organization id', async () => {
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

        await factories.doses.createMany(5, {
            administeredAt: new Date('2026-01-16'),
            scheduledAt: new Date('2026-01-16'),
            immunotherapyId: immunotherapy.id,
            administeredById: authenticatedUser.id,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id 
        });

        const result = await listDosesByTherapyUseCase.execute(immunotherapy.id, authenticatedUserAnotherOrg.activeOrgId);

        expect(result).toEqual([]);
    });
})