import { Test, TestingModule } from "@nestjs/testing"
import { CreateImmunotherapyUseCase } from "../../create-immunotherapy.use-case";
import { PrismaService } from "src/database/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { CreatePatientUseCase } from "src/patients/application/use-cases/create-patient.use-case";
import { CreateImmunotherapyDto } from "src/immunotherapies/application/dtos/create-immunotherapy.dto";
import { PrismaImmunotherapyRepository } from "src/immunotherapies/infrastructure/persistence/prisma-immunotherapy.repository";
import { IImmunotherapyRepository } from "src/immunotherapies/domain/contracts/immunotherapy.repository.interface";
import { IPatientRepository } from "src/patients/domain/contracts/patient.repository.interface";
import { PrismaPatientRepository } from "src/patients/infrastructure/persistence/prisma-patient.repository";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

describe('CreateImmunotherapyUseCase - Integration', () => {
    let module: TestingModule;
    let immunoUseCase: CreateImmunotherapyUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {
        
        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                CreateImmunotherapyUseCase,
                CreatePatientUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IImmunotherapyRepository,
                    useClass: PrismaImmunotherapyRepository
                },
                {
                    provide: IPatientRepository,
                    useClass: PrismaPatientRepository
                }
            ]
        }).compile();

        immunoUseCase = module.get(CreateImmunotherapyUseCase);
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

    it('should create complete immunotherapy for patient', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const dto: CreateImmunotherapyDto = {
            patient: {
                fullName: 'João Perini', 
                birthDate: new Date('1990-01-01'),
                weightInKg: 75,
                phoneNumber: '11999999999'
            },
            immunoType: 'Ácaros',
            administrationRoute: 'SUBCUTANEOUS',
            extract: "Der p 60 + der f 10% + blt 30%",
            inductionStartDate: new Date('2026-01-15'),
            targetConcentration: "1:10",
            targetVolume: 0.5,
            responsiblePhysicianId: authenticatedUser.id,
        };

        const result = await immunoUseCase.execute(dto, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.patient).toBeDefined();
        expect(result.immunotherapy).toBeDefined();
        expect(result.patient.primaryOrganizationId).toBe(authenticatedUser.activeOrgId);
        expect(result.immunotherapy.patientId).toBe(result.patient.id);

        const patientInDb = await prisma.patient.findUnique({
            where: { id: result.patient.id }
        });

        console.log(patientInDb)

        expect(patientInDb).not.toBeNull();
        expect(result.patient.fullName).toBe('João Perini');

        const immunotherapyInDb = await prisma.immunotherapy.findUnique({
            where: { id: result.immunotherapy.id },
        });

        console.log(immunotherapyInDb)

        expect(immunotherapyInDb).not.toBeNull();
        expect(immunotherapyInDb!.responsiblePhysicianId).toBe(authenticatedUser.id);
        expect(immunotherapyInDb!.createdById).toBe(authenticatedUser.id);
    });


    it('should throw and rollback if immunotherapy creation fails in repository', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

        const dto: CreateImmunotherapyDto = {
            patient: {
                fullName: 'Carla Martins', 
                birthDate: new Date('2000-01-01'),
                weightInKg: 80,
                phoneNumber: '11999999999'
            },
            immunoType: 'Ácaros',
            administrationRoute: 'SUBCUTANEOUS',
            extract: "Der p 60 + der f 10% + blt 30%",
            inductionStartDate: new Date('2026-01-15'),
            targetConcentration: "1:10",
            targetVolume: 0.5,
            responsiblePhysicianId: authenticatedUser.id,
        };

        jest.spyOn(immunoUseCase['immunotherapyRepository'], 'create').mockRejectedValueOnce(
            new PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.0.0' })
        );

        await expect(immunoUseCase.execute(dto, authenticatedUser)).rejects.toThrow(PrismaClientKnownRequestError);

        const immunoCount = await prisma.immunotherapy.count({
            where: { responsiblePhysicianId: authenticatedUser.id }
        });
        expect(immunoCount).toBe(0);

        const patientCount = await prisma.patient.count({
            where: { fullName: dto.patient.fullName }
        });
        expect(patientCount).toBe(0);
    });
})