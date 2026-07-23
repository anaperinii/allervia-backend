import { Test, TestingModule } from "@nestjs/testing"
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IImmunotherapyRepository } from "src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface";
import { PrismaImmunotherapyRepository } from "src/treatment-protocols/allergen-immunotherapy/therapies/prisma-immunotherapy.repository";
import { ListImmunotherapiesForPatientUseCase } from "../../list-immunotherapies-for-patient.use-case";

describe('ListImmunotherapiesByPatientUseCase - Integration', () => {
    let module: TestingModule;
    let listAllByPatient: ListImmunotherapiesForPatientUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {
        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                ListImmunotherapiesForPatientUseCase,
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

        listAllByPatient = module.get(ListImmunotherapiesForPatientUseCase);
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

    it('should list all immunotherapies by patient id correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const patients = await factories.patients.createMany(3, {
            organizationId: authenticatedUser.activeOrgId,
            createdById: authenticatedUser.id,
            updatedById: authenticatedUser.id
        });
   
        for (let i = 0; i < 3; i++) {
            await factories.immunotherapies.create({
                immunoType: i % 2 === 0 ? "Ácaros" : "Pólen",
                inductionStartDate: new Date('2026-01-15'),
                responsiblePhysicianId: authenticatedUser.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                patientId: i === 2 ? patients[0].id : patients[i].id
            });
        }
        
        const patientOneImmunos = await listAllByPatient.execute(patients[0].id, authenticatedUser.activeOrgId);
        const patientTwoImmunos = await listAllByPatient.execute(patients[1].id, authenticatedUser.activeOrgId);

        expect(patientOneImmunos).toHaveLength(2);
        console.log(patientOneImmunos);
        expect(patientTwoImmunos).toHaveLength(1);
        console.log(patientTwoImmunos)
    });
})