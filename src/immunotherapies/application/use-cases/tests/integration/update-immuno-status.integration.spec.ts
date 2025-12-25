import { TestingModule, Test } from "@nestjs/testing";
import { IImmunotherapyRepository } from "src/immunotherapies/domain/contracts/immunotherapy.repository.interface";
import { PrismaImmunotherapyRepository } from "src/immunotherapies/infrastructure/persistence/prisma-immunotherapy.repository";
import { PrismaService } from "src/database/prisma/prisma.service";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { TestFactories } from "test/factories";
import { UpdateImmunotherapyStatusUseCase } from "../../update-immunotherapy-status.use-case";
import { TherapyStatus } from "@prisma/client";
import { BadRequestException } from "@nestjs/common";
import { ulid } from "ulid";
import { ImmunotherapyNotFoundException } from "src/immunotherapies/domain/exceptions/immunotherapy-not-found.exception";

describe('UpdateImmunotherapyStatusUseCase - Integration', () => {
    let module: TestingModule;
    let immunoUpdateStatusUseCase: UpdateImmunotherapyStatusUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                UpdateImmunotherapyStatusUseCase,
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

        immunoUpdateStatusUseCase = module.get(UpdateImmunotherapyStatusUseCase);
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

    it('should change immunotherapy status for SUSPENDED', async () => {
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

        const result = await immunoUpdateStatusUseCase.execute(immunotherapy.id, { status: 'SUSPENDED' }, authenticatedUser.activeOrgId, authenticatedUser);

        console.log(result);
        expect(result).toBeDefined();
        expect(result.status).toBe(TherapyStatus.SUSPENDED);
    });

    it('should change immunotherapy suspended status for IN_PROGRESS', async () => {
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
            patientId: patient.id,
            status: 'SUSPENDED'
        }); 
        
        const result = await immunoUpdateStatusUseCase.execute(immunotherapy.id, { status: 'IN_PROGRESS' }, authenticatedUser.activeOrgId, authenticatedUser);

        console.log(result);
        expect(result).toBeDefined();
        expect(result.status).toBe(TherapyStatus.IN_PROGRESS);
    });

    it('should throw an error by updating immunotherapy with already the respectively status', async () => {
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

        await expect(immunoUpdateStatusUseCase.execute(immunotherapy.id, { status: 'IN_PROGRESS' }, authenticatedUser.activeOrgId, authenticatedUser)).rejects.toThrow(BadRequestException);
    });

    it('should throw not found exception when updating a non exist immunotherapy', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();
        
        await expect(immunoUpdateStatusUseCase.execute(ulid(), { status: 'IN_PROGRESS' }, authenticatedUser.activeOrgId, authenticatedUser)).rejects.toThrow(ImmunotherapyNotFoundException);
    });

    // TO DO 
    // it('should throw an error by setting completed on immunotherapy status if it doesnt achieve target volume and concentration', async () => {
        
    // });
})