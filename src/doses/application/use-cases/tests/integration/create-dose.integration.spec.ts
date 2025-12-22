import { Test, TestingModule } from "@nestjs/testing"
import { CreateDoseUseCase } from "../../create-dose.use-case";
import { PrismaService } from "src/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IDoseRepository } from "src/doses/domain/contracts/dose.repository.interface";
import { PrismaDoseRepository } from "src/doses/infrastructure/persistence/prisma-dose.repository";
import { BadRequestException } from "@nestjs/common";

describe('CreateDoseUseCase - Integration', () => {
    let module: TestingModule;
    let createDoseUseCase: CreateDoseUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                CreateDoseUseCase,
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

        createDoseUseCase = module.get(CreateDoseUseCase);
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

    it('should create correctly a dose for immunotherapy', async () => {
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

        const dto = {
            concentration: "1:10000",
            volume: 0.1,
            administeredAt: new Date('2026-01-16'),
            scheduledAt: new Date('2026-01-16'),
            nextIntervalInDays: 7
        }

        const result = await createDoseUseCase.execute(immunotherapy.id, dto, authenticatedUser);

        expect(result).toBeDefined();
        console.log(result);
        expect(result.administeredById).toBe(authenticatedUser.professionalId);
    });

    it('should throw a bad request exception when registering a dose with a non professional user', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const authenticatedAdminUser = await factories.users.createAuthenticatedAdmin();

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

        const dto = {
            concentration: "1:10000",
            volume: 0.1,
            administeredAt: new Date('2026-01-16'),
            scheduledAt: new Date('2026-01-16'),
            nextIntervalInDays: 7
        }

        await expect(createDoseUseCase.execute(immunotherapy.id, dto, authenticatedAdminUser)).rejects.toThrow(BadRequestException);

    });
})