import { Test, TestingModule } from "@nestjs/testing"
import { FindImmunotherapyUseCase } from "../../find-immunotherapy.use-case";
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IImmunotherapyRepository } from "src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface";
import { PrismaImmunotherapyRepository } from "src/treatment-protocols/allergen-immunotherapy/therapies/prisma-immunotherapy.repository";
import { ulid } from "ulid";
import { ImmunotherapyNotFoundException } from "src/treatment-protocols/allergen-immunotherapy/therapies/domain/exceptions/immunotherapy-not-found.exception";

describe('FindImmunotherapyUseCase - Integration', () => {
    let module: TestingModule;
    let immunoFindUseCase: FindImmunotherapyUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                FindImmunotherapyUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IImmunotherapyRepository,
                    useClass: PrismaImmunotherapyRepository
                }
            ]
        }).compile();

        immunoFindUseCase = module.get(FindImmunotherapyUseCase);
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

    
    it('should return the immunotherapy correctly by id', async () => {
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

        const result = await immunoFindUseCase.execute(immunotherapy.id, authenticatedUser.activeOrgId);
        
        expect(result).toBeDefined();
        expect(result.patientId).toBe(patient.id);
        console.log(result);
    });

    it('should throw a not found exception if the respectively immunotherapy doesnt exists', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        await expect(immunoFindUseCase.execute(ulid(), authenticatedUser.activeOrgId)).rejects.toThrow(ImmunotherapyNotFoundException);
        
    });

    it('should throw a not found exception if the respectively immunotherapy was registered in another organization', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const authenticatedUserAnotherOrg = await factories.users.createAuthenticatedPhysicianProfessional();
        const patient = await factories.patients.create({
            primaryOrganizationId: authenticatedUserAnotherOrg.activeOrgId,
            createdById: authenticatedUserAnotherOrg.id,
            updatedById: authenticatedUserAnotherOrg.id
        });
        const immunotherapy = await factories.immunotherapies.create({
            inductionStartDate: new Date('2026-01-15'),
            responsiblePhysicianId: authenticatedUserAnotherOrg.id,
            createdById: authenticatedUserAnotherOrg.id,
            updatedById: authenticatedUserAnotherOrg.id,
            patientId: patient.id
        });

       await expect(immunoFindUseCase.execute(immunotherapy.id, authenticatedUser.activeOrgId)).rejects.toThrow(ImmunotherapyNotFoundException);
    });
})