import { Test, TestingModule } from "@nestjs/testing"
import { CreateImmunotherapyUseCase } from "src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/create-immunotherapy.use-case";
import { PrismaService } from "src/infra/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { CreatePatientUseCase } from "src/patients/use-cases/create-patient.use-case";
import { CreateImmunotherapyDto } from "src/treatment-protocols/allergen-immunotherapy/therapies/dtos/create-immunotherapy.dto";
import { PrismaImmunotherapyRepository } from "src/treatment-protocols/allergen-immunotherapy/therapies/prisma-immunotherapy.repository";
import { IImmunotherapyRepository } from "src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface";
import { PatientRepository } from "src/patients/patient.repository";
import { PrismaPatientRepository } from "src/patients/prisma-patient.repository";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { IBuildUpPhase } from "src/treatment-protocols/allergen-immunotherapy/clinical-rules/build-up-phase/build-up-phase.interface";
import { BuildUpPhaseService } from "src/treatment-protocols/allergen-immunotherapy/clinical-rules/build-up-phase/build-up-phase.service";
import { RegisterStartingDoseUseCase } from "src/treatment-protocols/allergen-immunotherapy/clinical-rules/build-up-phase/register-starting-dose.use-case";
import { RegisterNextScheduledBuildUpUseCase } from "src/treatment-protocols/allergen-immunotherapy/clinical-rules/build-up-phase/register-scheduled-build-up.use-case";
import { CreateDoseUseCase } from "src/treatment-protocols/allergen-immunotherapy/dosing/use-cases/create-dose.use-case";
import { IDoseRepository } from "src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface";
import { PrismaDoseRepository } from "src/treatment-protocols/allergen-immunotherapy/dosing/prisma-dose.repository";
import { CountDosesByConcentration } from "src/treatment-protocols/allergen-immunotherapy/dosing/use-cases/count-doses-by-concentration.use-case";

describe('CreateImmunotherapyUseCase - Integration', () => {
    let module: TestingModule;
    let immunoUseCase: CreateImmunotherapyUseCase;
    let buildUpProtocol: IBuildUpPhase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {
        
        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                CreateImmunotherapyUseCase,
                CreatePatientUseCase,
                CreateDoseUseCase,
                RegisterStartingDoseUseCase,
                RegisterNextScheduledBuildUpUseCase,
                CountDosesByConcentration,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IImmunotherapyRepository,
                    useClass: PrismaImmunotherapyRepository
                },
                {
                    provide: PatientRepository,
                    useClass: PrismaPatientRepository
                },
                {
                    provide: IDoseRepository,
                    useClass: PrismaDoseRepository
                },
                {
                    provide: IBuildUpPhase,
                    useClass: BuildUpPhaseService
                }
            ]
        }).compile();

        immunoUseCase = module.get(CreateImmunotherapyUseCase);
        buildUpProtocol = module.get(IBuildUpPhase);
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

    it('should create complete immunotherapy for patient and register the first dose correctly', async () => {
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
            targetConcentration: 10,
            targetVolume: 0.5,
            responsiblePhysicianId: authenticatedUser.id,
        };

        const result = await immunoUseCase.execute(dto, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.patient).toBeDefined();
        expect(result.immunotherapy).toBeDefined();
        expect(result.patient.organizationId).toBe(authenticatedUser.activeOrgId);
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

        const firstDose = await prisma.dose.findFirst({
            where: {
                immunotherapyId: result.immunotherapy.id
            }
        });

        console.log(firstDose);

        expect(firstDose).toBeDefined();
        
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
            targetConcentration: 10,
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