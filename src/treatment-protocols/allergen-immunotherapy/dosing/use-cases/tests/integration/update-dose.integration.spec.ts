import { Test, TestingModule } from "@nestjs/testing"
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IDoseRepository } from "src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface";
import { PrismaDoseRepository } from "src/treatment-protocols/allergen-immunotherapy/dosing/prisma-dose.repository";
import { UpdateDoseStatusUseCase } from "../../update-dose-status.use-case";
import { DoseStatus } from "@prisma/client";
import { InvalidDoseStatusException } from "src/treatment-protocols/allergen-immunotherapy/dosing/domain/exceptions/invalid-dose-status.exception";
import { ulid } from "ulid";
import { NotFoundException } from "@nestjs/common";

describe('UpdateDoseUseCase - Integration', () => {
    let module: TestingModule;
    let updateDoseStatusUseCase: UpdateDoseStatusUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                UpdateDoseStatusUseCase,
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

        updateDoseStatusUseCase = module.get(UpdateDoseStatusUseCase);
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

    it('should change dose status to administered for entered_in_error', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const patient = await factories.patients.create({
            primaryOrganizationId: authenticatedUser.activeOrgId,
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
            updatedById: authenticatedUser.id,
            status: 'ADMINISTERED_ON_SCHEDULE'
        });

        console.log(dose)

        const result = await updateDoseStatusUseCase.execute(dose.id, { status: 'ENTERED_IN_ERROR' }, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.status).toBe(DoseStatus.ENTERED_IN_ERROR);
        console.log(result);
    });

    it('should throw an invalid dose status exception when passing other than entered_in_error in an administered dose', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const patient = await factories.patients.create({
            primaryOrganizationId: authenticatedUser.activeOrgId,
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
            updatedById: authenticatedUser.id,
            status: 'ADMINISTERED_ON_SCHEDULE'
        });

        console.log(dose)

       await expect(updateDoseStatusUseCase.execute(dose.id, { status: 'SCHEDULED' }, authenticatedUser)).rejects.toThrow(InvalidDoseStatusException);

    });

    it('should throw an invalid dose status exception when passing entered_in_error in an scheduled dose', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const patient = await factories.patients.create({
            primaryOrganizationId: authenticatedUser.activeOrgId,
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

       await expect(updateDoseStatusUseCase.execute(dose.id, { status: 'ENTERED_IN_ERROR' }, authenticatedUser)).rejects.toThrow(InvalidDoseStatusException);

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

       await expect(updateDoseStatusUseCase.execute(ulid(), { status: 'ENTERED_IN_ERROR' }, authenticatedUser)).rejects.toThrow(NotFoundException);
    });
})