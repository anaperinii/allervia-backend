import { Test, TestingModule } from "@nestjs/testing"
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IDoseRepository } from "src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface";
import { PrismaDoseRepository } from "src/treatment-protocols/allergen-immunotherapy/dosing/infrastructure/repositories/prisma-dose.repository";
import { ulid } from "ulid";
import { DoseNotFoundException } from "src/treatment-protocols/allergen-immunotherapy/dosing/domain/exceptions/dose-not-found.exception";
import { IBuildUpPhase } from "src/treatment-protocols/allergen-immunotherapy/clinical-rules/build-up-phase/build-up-phase.interface";
import { BuildUpPhaseService } from "src/treatment-protocols/allergen-immunotherapy/clinical-rules/build-up-phase/build-up-phase.service";
import { IMaintenancePhase } from "src/treatment-protocols/allergen-immunotherapy/clinical-rules/maintenance-phase/maintenance-phase.interface";
import { MaintenancePhaseService } from "src/treatment-protocols/allergen-immunotherapy/clinical-rules/maintenance-phase/maintenance-phase.service";
import { FindDoseUseCase } from "../../find-dose.use-case";
import { FindImmunotherapyUseCase } from "src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/find-immunotherapy.use-case";
import { IImmunotherapyRepository } from "src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface";
import { PrismaImmunotherapyRepository } from "src/treatment-protocols/allergen-immunotherapy/therapies/infrastructure/repositories/prisma-immunotherapy.repository";
import { CreateDoseUseCase } from "../../create-dose.use-case";
import { CountDosesByConcentration } from "../../count-doses-by-concentration.use-case";
import { CountDosesByIntervalUseCase } from "../../count-doses-by-interval.use-case";
import { RegisterStartingDoseUseCase } from "src/treatment-protocols/allergen-immunotherapy/clinical-rules/build-up-phase/register-starting-dose.use-case";
import { RegisterNextScheduledBuildUpUseCase } from "src/treatment-protocols/allergen-immunotherapy/clinical-rules/build-up-phase/register-scheduled-build-up.use-case";
import { RegisterNextScheduledMaintenanceUseCase } from "src/treatment-protocols/allergen-immunotherapy/clinical-rules/maintenance-phase/register-scheduled-maintenance.use-case";
import { BUILD_UP_INTERVAL, STARTING_DOSE_CONCENTRATION, STARTING_DOSE_VOLUME } from "src/treatment-protocols/allergen-immunotherapy/clinical-rules/build-up-phase/build-up-phase.variables";
import { MAINTENANCE_INTERVALS } from "src/treatment-protocols/allergen-immunotherapy/clinical-rules/maintenance-phase/maintenance-phase.variables";
import { DoseStatus } from "@prisma/client";
import { addDate } from "src/shared/utils";
import { RegisterAdministeredDoseUseCase } from "../../register-administered-dose.use-case";

describe('registerAdministeredDoseUseCase - Integration', () => {
    let module: TestingModule;
    let registerAdministeredDoseUseCase: RegisterAdministeredDoseUseCase;
    let findDoseUseCase: FindDoseUseCase;
    let findImmunotherapyUseCase: FindImmunotherapyUseCase;
    let buildUpProtocol: IBuildUpPhase;
    let maintenanceProtocol: IMaintenancePhase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                RegisterAdministeredDoseUseCase,
                FindDoseUseCase,
                FindImmunotherapyUseCase,
                CreateDoseUseCase,
                CountDosesByConcentration,
                CountDosesByIntervalUseCase,
                RegisterStartingDoseUseCase,
                RegisterNextScheduledBuildUpUseCase,
                RegisterNextScheduledMaintenanceUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IDoseRepository,
                    useClass: PrismaDoseRepository
                },
                {
                    provide: IImmunotherapyRepository,
                    useClass: PrismaImmunotherapyRepository
                },
                {
                    provide: IBuildUpPhase,
                    useClass: BuildUpPhaseService
                },
                {
                    provide: IMaintenancePhase,
                    useClass: MaintenancePhaseService
                }
            ]
        }).compile();

        registerAdministeredDoseUseCase = module.get(RegisterAdministeredDoseUseCase);
        buildUpProtocol = module.get(IBuildUpPhase);
        maintenanceProtocol = module.get(IMaintenancePhase);
        findDoseUseCase = module.get(FindDoseUseCase);
        findImmunotherapyUseCase = module.get(FindImmunotherapyUseCase);
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

    describe('Build-up Phase - Atualização de dose agendada e criação automática da próxima dose', () => {
        it('deve atualizar dose agendada e criar próxima dose com mesma concentração quando menos de 5 doses na concentração atual', async () => {
            const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

            const patient = await factories.patients.create({
                primaryOrganizationId: authenticatedUser.activeOrgId,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id
            });

            const immunotherapy = await factories.immunotherapies.create({
                inductionStartDate: new Date('2026-01-15'),
                targetConcentration: 10,
                targetVolume: 0.5,
                responsiblePhysicianId: authenticatedUser.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                patientId: patient.id
            });

            // Criar dose agendada (SCHEDULED) com concentração inicial
            const scheduledDose = await factories.doses.create({
                concentration: STARTING_DOSE_CONCENTRATION,
                volume: STARTING_DOSE_VOLUME,
                scheduledAt: new Date('2026-01-22'),
                immunotherapyId: immunotherapy.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                status: 'SCHEDULED',
                nextIntervalInDays: BUILD_UP_INTERVAL
            });

            const administeredDate = new Date('2026-01-22');
            const dto = {
                concentration: STARTING_DOSE_CONCENTRATION,
                volume: STARTING_DOSE_VOLUME * 2, 
                administeredAt: administeredDate,
                notes: "Dose administrada com sucesso"
            };

            const result = await registerAdministeredDoseUseCase.execute(scheduledDose.id, dto, authenticatedUser);

            expect(result).toBeDefined();
            expect(result.concentration).toBe(STARTING_DOSE_CONCENTRATION);
            expect(result.volume).toBe(STARTING_DOSE_VOLUME * 2);
            expect(result.administeredAt).toBeDefined();
            expect(result.notes).toBe(dto.notes);
            expect([DoseStatus.ADMINISTERED_ON_SCHEDULE, DoseStatus.ADMINISTERED_OFF_SCHEDULE]).toContain(result.status);

            // Verificar se a próxima dose foi criada automaticamente
            const nextDose = await prisma.dose.findFirst({
                where: {
                    immunotherapyId: immunotherapy.id,
                    id: { not: scheduledDose.id }
                },
                orderBy: { scheduledAt: 'asc' }
            });

            expect(nextDose).toBeDefined();
            expect(nextDose!.status).toBe(DoseStatus.SCHEDULED);
            expect(nextDose!.concentration).toBe(STARTING_DOSE_CONCENTRATION); // Mesma concentração
            expect(nextDose!.volume).toBe(STARTING_DOSE_VOLUME * 4); // Volume dobrado novamente
            expect(nextDose!.nextIntervalInDays).toBe(BUILD_UP_INTERVAL);
            const expectedScheduledDate = addDate(administeredDate, BUILD_UP_INTERVAL);
            expect(new Date(nextDose!.scheduledAt).toDateString()).toBe(expectedScheduledDate.toDateString());
        });

        it('deve atualizar dose agendada e criar próxima dose com nova concentração quando totalizar 4 doses na respectiva fase', async () => {
            const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

            const patient = await factories.patients.create({
                primaryOrganizationId: authenticatedUser.activeOrgId,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id
            });

            const immunotherapy = await factories.immunotherapies.create({
                inductionStartDate: new Date('2026-01-15'),
                targetConcentration: 10,
                targetVolume: 0.5,
                responsiblePhysicianId: authenticatedUser.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                patientId: patient.id
            });

            const currentConcentration = STARTING_DOSE_CONCENTRATION;
            
            // Criar 3 doses já administradas na mesma concentração (totalizará 4 após atualizar a próxima)
            // Progressão: 0.1 → 0.2 → 0.4 → 0.8
            const volumes = [0.1, 0.2, 0.4];
            for (let i = 0; i < 3; i++) {
                const date = new Date(2026, 0, 15 + i * 7); // Janeiro 2026
                await factories.doses.create({
                    concentration: currentConcentration,
                    volume: volumes[i],
                    scheduledAt: date,
                    administeredAt: date,
                    immunotherapyId: immunotherapy.id,
                    administeredById: authenticatedUser.id,
                    createdById: authenticatedUser.id,
                    updatedById: authenticatedUser.id,
                    status: 'ADMINISTERED_ON_SCHEDULE',
                    nextIntervalInDays: BUILD_UP_INTERVAL
                });
            }

            // Criar dose agendada (SCHEDULED) - será a 4ª dose nesta concentração com volume 0.8
            const scheduledDose = await factories.doses.create({
                concentration: currentConcentration,
                volume: 0.8, 
                scheduledAt: new Date('2026-02-05'),
                immunotherapyId: immunotherapy.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                status: 'SCHEDULED',
                nextIntervalInDays: BUILD_UP_INTERVAL
            });

            const administeredDate = new Date('2026-02-05');
            const dto = {
                concentration: currentConcentration,
                volume: 0.8, 
                administeredAt: administeredDate
            };

            const result = await registerAdministeredDoseUseCase.execute(scheduledDose.id, dto, authenticatedUser);

            expect(result).toBeDefined();
            expect([DoseStatus.ADMINISTERED_ON_SCHEDULE, DoseStatus.ADMINISTERED_OFF_SCHEDULE]).toContain(result.status);

            // Verificar se a próxima dose foi criada com nova concentração
            const nextDose = await prisma.dose.findFirst({
                where: {
                    immunotherapyId: immunotherapy.id,
                    id: { not: scheduledDose.id },
                    status: 'SCHEDULED'
                },
                orderBy: { createdAt: 'desc' }
            });

            expect(nextDose).toBeDefined();
            expect(nextDose!.status).toBe(DoseStatus.SCHEDULED);
            expect(nextDose!.concentration).toBe(currentConcentration / 10); // Nova concentração (dividida por 10)
            expect(nextDose!.volume).toBe(STARTING_DOSE_VOLUME); // Volume volta ao inicial
            expect(nextDose!.nextIntervalInDays).toBe(BUILD_UP_INTERVAL);
        });

        it('deve atualizar dose agendada e criar próxima dose de manutenção quando atinge targetConcentration e volume targetVolume - 0.1', async () => {
            const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

            const patient = await factories.patients.create({
                primaryOrganizationId: authenticatedUser.activeOrgId,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id
            });

            const targetConcentration = 10;
            const targetVolume = 0.5;

            const immunotherapy = await factories.immunotherapies.create({
                inductionStartDate: new Date('2026-01-15'),
                targetConcentration: targetConcentration,
                targetVolume: targetVolume,
                responsiblePhysicianId: authenticatedUser.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                patientId: patient.id
            });

            // Criar dose agendada com targetConcentration e volume targetVolume - 0.1
            const scheduledDose = await factories.doses.create({
                concentration: targetConcentration,
                volume: targetVolume - 0.1,
                scheduledAt: new Date('2026-03-15'),
                immunotherapyId: immunotherapy.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                status: 'SCHEDULED',
                nextIntervalInDays: BUILD_UP_INTERVAL
            });

            const administeredDate = new Date('2026-03-15');
            const dto = {
                concentration: targetConcentration,
                volume: targetVolume - 0.1,
                administeredAt: administeredDate
            };

            const result = await registerAdministeredDoseUseCase.execute(scheduledDose.id, dto, authenticatedUser);

            expect(result).toBeDefined();
            expect([DoseStatus.ADMINISTERED_ON_SCHEDULE, DoseStatus.ADMINISTERED_OFF_SCHEDULE]).toContain(result.status);

            // Verificar se a próxima dose foi criada com targetConcentration e targetVolume
            const nextDose = await prisma.dose.findFirst({
                where: {
                    immunotherapyId: immunotherapy.id,
                    id: { not: scheduledDose.id },
                    status: 'SCHEDULED'
                },
                orderBy: { createdAt: 'desc' }
            });

            expect(nextDose).toBeDefined();
            expect(nextDose!.status).toBe(DoseStatus.SCHEDULED);
            expect(nextDose!.concentration).toBe(targetConcentration);
            expect(nextDose!.volume).toBe(targetVolume); // Volume completo de manutenção
            expect(nextDose!.nextIntervalInDays).toBe(BUILD_UP_INTERVAL);
        });
    });

    describe('Maintenance Phase - Atualização de dose agendada e criação automática da próxima dose', () => {
        it('deve atualizar dose agendada e criar próxima dose de manutenção quando atinge targetConcentration e targetVolume', async () => {
            const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

            const patient = await factories.patients.create({
                primaryOrganizationId: authenticatedUser.activeOrgId,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id
            });

            const targetConcentration = 10;
            const targetVolume = 0.5;

            const immunotherapy = await factories.immunotherapies.create({
                inductionStartDate: new Date('2026-01-15'),
                targetConcentration: targetConcentration,
                targetVolume: targetVolume,
                responsiblePhysicianId: authenticatedUser.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                patientId: patient.id
            });

            // Criar dose agendada com targetConcentration e targetVolume (primeira dose de manutenção)
            const scheduledDose = await factories.doses.create({
                concentration: targetConcentration,
                volume: targetVolume,
                scheduledAt: new Date('2026-03-22'),
                immunotherapyId: immunotherapy.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                status: 'SCHEDULED',
                nextIntervalInDays: BUILD_UP_INTERVAL // 7 dias (última do build-up)
            });

            const administeredDate = new Date('2026-03-22');
            const dto = {
                concentration: targetConcentration,
                volume: targetVolume,
                administeredAt: administeredDate,
                notes: "Primeira dose de manutenção"
            };

            const result = await registerAdministeredDoseUseCase.execute(scheduledDose.id, dto, authenticatedUser);

            expect(result).toBeDefined();
            expect([DoseStatus.ADMINISTERED_ON_SCHEDULE, DoseStatus.ADMINISTERED_OFF_SCHEDULE]).toContain(result.status);
            expect(result.concentration).toBe(targetConcentration);
            expect(result.volume).toBe(targetVolume);

            // Verificar se a próxima dose foi criada com intervalo de 14 dias (primeiro intervalo de manutenção)
            const nextDose = await prisma.dose.findFirst({
                where: {
                    immunotherapyId: immunotherapy.id,
                    id: { not: scheduledDose.id },
                    status: 'SCHEDULED'
                },
                orderBy: { createdAt: 'desc' }
            });

            expect(nextDose).toBeDefined();
            expect(nextDose!.status).toBe(DoseStatus.SCHEDULED);
            expect(nextDose!.concentration).toBe(targetConcentration);
            expect(nextDose!.volume).toBe(targetVolume);
            expect(nextDose!.nextIntervalInDays).toBe(MAINTENANCE_INTERVALS[0].days); // 14 dias
            const expectedScheduledDate = addDate(administeredDate, MAINTENANCE_INTERVALS[0].days);
            expect(new Date(nextDose!.scheduledAt).toDateString()).toBe(expectedScheduledDate.toDateString());
        });

        it('deve manter o mesmo intervalo quando menos de 4 doses no intervalo atual de manutenção', async () => {
            const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

            const patient = await factories.patients.create({
                primaryOrganizationId: authenticatedUser.activeOrgId,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id
            });

            const targetConcentration = 10;
            const targetVolume = 0.5;
            const currentInterval = MAINTENANCE_INTERVALS[0].days; // 14 dias

            const immunotherapy = await factories.immunotherapies.create({
                inductionStartDate: new Date('2026-01-15'),
                targetConcentration: targetConcentration,
                targetVolume: targetVolume,
                responsiblePhysicianId: authenticatedUser.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                patientId: patient.id
            });

            // Criar 2 doses já administradas com intervalo de 14 dias (totalizará 3 após atualizar a próxima)
            for (let i = 0; i < 2; i++) {
                const date = new Date(2026, 3, 5 + i * 2); // Abril 2026
                await factories.doses.create({
                    concentration: targetConcentration,
                    volume: targetVolume,
                    scheduledAt: date,
                    administeredAt: date,
                    immunotherapyId: immunotherapy.id,
                    administeredById: authenticatedUser.id,
                    createdById: authenticatedUser.id,
                    updatedById: authenticatedUser.id,
                    status: 'ADMINISTERED_ON_SCHEDULE',
                    nextIntervalInDays: currentInterval
                });
            }

            // Criar dose agendada (3ª dose com intervalo de 14 dias)
            const scheduledDose = await factories.doses.create({
                concentration: targetConcentration,
                volume: targetVolume,
                scheduledAt: new Date('2026-04-09'),
                immunotherapyId: immunotherapy.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                status: 'SCHEDULED',
                nextIntervalInDays: currentInterval
            });

            const administeredDate = new Date('2026-04-09');
            const dto = {
                concentration: targetConcentration,
                volume: targetVolume,
                administeredAt: administeredDate
            };

            const result = await registerAdministeredDoseUseCase.execute(scheduledDose.id, dto, authenticatedUser);

            expect(result).toBeDefined();
            expect([DoseStatus.ADMINISTERED_ON_SCHEDULE, DoseStatus.ADMINISTERED_OFF_SCHEDULE]).toContain(result.status);

            // Verificar se a próxima dose foi criada mantendo o mesmo intervalo (14 dias)
            const nextDose = await prisma.dose.findFirst({
                where: {
                    immunotherapyId: immunotherapy.id,
                    id: { not: scheduledDose.id },
                    status: 'SCHEDULED'
                },
                orderBy: { createdAt: 'desc' }
            });

            expect(nextDose).toBeDefined();
            expect(nextDose!.status).toBe(DoseStatus.SCHEDULED);
            expect(nextDose!.nextIntervalInDays).toBe(currentInterval); // Mantém 14 dias
            const expectedScheduledDate = addDate(administeredDate, currentInterval);
            expect(new Date(nextDose!.scheduledAt).toDateString()).toBe(expectedScheduledDate.toDateString());
        });

        it('deve progredir para o próximo intervalo quando completa 4 doses no intervalo atual de manutenção', async () => {
            const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

            const patient = await factories.patients.create({
                primaryOrganizationId: authenticatedUser.activeOrgId,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id
            });

            const targetConcentration = 10;
            const targetVolume = 0.5;
            const currentInterval = MAINTENANCE_INTERVALS[0].days; 

            const immunotherapy = await factories.immunotherapies.create({
                inductionStartDate: new Date('2026-01-15'),
                targetConcentration: targetConcentration,
                targetVolume: targetVolume,
                responsiblePhysicianId: authenticatedUser.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                patientId: patient.id
            });

            // Criar 3 doses já administradas com intervalo de 14 dias (totalizará 4 após atualizar a próxima)
            for (let i = 0; i < 3; i++) {
                const date = new Date(2026, 3, 5 + i * 2); // Abril 2026
                await factories.doses.create({
                    concentration: targetConcentration,
                    volume: targetVolume,
                    scheduledAt: date,
                    administeredAt: date,
                    immunotherapyId: immunotherapy.id,
                    administeredById: authenticatedUser.id,
                    createdById: authenticatedUser.id,
                    updatedById: authenticatedUser.id,
                    status: 'ADMINISTERED_ON_SCHEDULE',
                    nextIntervalInDays: currentInterval
                });
            }

            // Criar dose agendada (4ª dose com intervalo de 14 dias)
            const scheduledDose = await factories.doses.create({
                concentration: targetConcentration,
                volume: targetVolume,
                scheduledAt: new Date('2026-04-11'),
                immunotherapyId: immunotherapy.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                status: 'SCHEDULED',
                nextIntervalInDays: currentInterval
            });

            const administeredDate = new Date('2026-04-11');
            const dto = {
                concentration: targetConcentration,
                volume: targetVolume,
                administeredAt: administeredDate
            };

            const result = await registerAdministeredDoseUseCase.execute(scheduledDose.id, dto, authenticatedUser);

            expect(result).toBeDefined();
            expect([DoseStatus.ADMINISTERED_ON_SCHEDULE, DoseStatus.ADMINISTERED_OFF_SCHEDULE]).toContain(result.status);

            // Verificar se a próxima dose foi criada com o próximo intervalo (21 dias)
            const nextDose = await prisma.dose.findFirst({
                where: {
                    immunotherapyId: immunotherapy.id,
                    id: { not: scheduledDose.id },
                    status: 'SCHEDULED'
                },
                orderBy: { createdAt: 'desc' }
            });

            expect(nextDose).toBeDefined();
            expect(nextDose!.status).toBe(DoseStatus.SCHEDULED);
            expect(nextDose!.nextIntervalInDays).toBe(MAINTENANCE_INTERVALS[1].days); // 21 dias (próximo intervalo)
            const expectedScheduledDate = addDate(administeredDate, MAINTENANCE_INTERVALS[1].days);
            expect(new Date(nextDose!.scheduledAt).toDateString()).toBe(expectedScheduledDate.toDateString());
        });

        it('deve manter o último intervalo quando já está no último intervalo de manutenção', async () => {
            const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

            const patient = await factories.patients.create({
                primaryOrganizationId: authenticatedUser.activeOrgId,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id
            });

            const targetConcentration = 10;
            const targetVolume = 0.5;
            const lastInterval = MAINTENANCE_INTERVALS[MAINTENANCE_INTERVALS.length - 1].days; // 28 dias

            const immunotherapy = await factories.immunotherapies.create({
                inductionStartDate: new Date('2026-01-15'),
                targetConcentration: targetConcentration,
                targetVolume: targetVolume,
                responsiblePhysicianId: authenticatedUser.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                patientId: patient.id
            });

            // Criar 4 doses já administradas com intervalo de 28 dias (último intervalo)
            for (let i = 0; i < 3; i++) {
                const date = new Date(2026, 4, 1 + i * 4); // Maio 2026
                await factories.doses.create({
                    concentration: targetConcentration,
                    volume: targetVolume,
                    scheduledAt: date,
                    administeredAt: date,
                    immunotherapyId: immunotherapy.id,
                    administeredById: authenticatedUser.id,
                    createdById: authenticatedUser.id,
                    updatedById: authenticatedUser.id,
                    status: 'ADMINISTERED_ON_SCHEDULE',
                    nextIntervalInDays: lastInterval
                });
            }

            // Criar dose agendada (4ª dose com intervalo de 28 dias)
            const scheduledDose = await factories.doses.create({
                concentration: targetConcentration,
                volume: targetVolume,
                scheduledAt: new Date('2026-05-21'),
                immunotherapyId: immunotherapy.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                status: 'SCHEDULED',
                nextIntervalInDays: lastInterval
            });

            const administeredDate = new Date('2026-05-21');
            const dto = {
                concentration: targetConcentration,
                volume: targetVolume,
                administeredAt: administeredDate
            };

            const result = await registerAdministeredDoseUseCase.execute(scheduledDose.id, dto, authenticatedUser);

            expect(result).toBeDefined();
            expect([DoseStatus.ADMINISTERED_ON_SCHEDULE, DoseStatus.ADMINISTERED_OFF_SCHEDULE]).toContain(result.status);

            // Verificar se a próxima dose foi criada mantendo o último intervalo (28 dias)
            const nextDose = await prisma.dose.findFirst({
                where: {
                    immunotherapyId: immunotherapy.id,
                    id: { not: scheduledDose.id },
                    status: 'SCHEDULED'
                },
                orderBy: { createdAt: 'desc' }
            });

            expect(nextDose).toBeDefined();
            expect(nextDose!.status).toBe(DoseStatus.SCHEDULED);
            expect(nextDose!.nextIntervalInDays).toBe(lastInterval); // Mantém 28 dias (último intervalo)
            const expectedScheduledDate = addDate(administeredDate, lastInterval);
            expect(new Date(nextDose!.scheduledAt).toDateString()).toBe(expectedScheduledDate.toDateString());
        });
    });

    describe('Status de administração - On Schedule vs Off Schedule', () => {
        it('deve marcar como ADMINISTERED_ON_SCHEDULE quando administrada na data agendada', async () => {
            const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

            const patient = await factories.patients.create({
                primaryOrganizationId: authenticatedUser.activeOrgId,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id
            });

            const immunotherapy = await factories.immunotherapies.create({
                inductionStartDate: new Date('2026-01-15'),
                targetConcentration: 10,
                targetVolume: 0.5,
                responsiblePhysicianId: authenticatedUser.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                patientId: patient.id
            });

            const scheduledDate = new Date('2026-01-22');
            const scheduledDose = await factories.doses.create({
                concentration: STARTING_DOSE_CONCENTRATION,
                volume: STARTING_DOSE_VOLUME,
                scheduledAt: scheduledDate,
                immunotherapyId: immunotherapy.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                status: 'SCHEDULED',
                nextIntervalInDays: BUILD_UP_INTERVAL
            });

            // Administrar na mesma data agendada
            const dto = {
                concentration: STARTING_DOSE_CONCENTRATION,
                volume: STARTING_DOSE_VOLUME,
                administeredAt: new Date('2026-01-22T10:00:00') // Mesma data, hora diferente
            };

            const result = await registerAdministeredDoseUseCase.execute(scheduledDose.id, dto, authenticatedUser);

            expect(result).toBeDefined();
            expect(result.status).toBe(DoseStatus.ADMINISTERED_ON_SCHEDULE);
            expect(result.administeredAt).toBeDefined();
        });

        it('deve marcar como ADMINISTERED_OFF_SCHEDULE quando administrada em data diferente da agendada', async () => {
            const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

            const patient = await factories.patients.create({
                primaryOrganizationId: authenticatedUser.activeOrgId,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id
            });

            const immunotherapy = await factories.immunotherapies.create({
                inductionStartDate: new Date('2026-01-15'),
                targetConcentration: 10,
                targetVolume: 0.5,
                responsiblePhysicianId: authenticatedUser.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                patientId: patient.id
            });

            const scheduledDate = new Date('2026-01-22');
            const scheduledDose = await factories.doses.create({
                concentration: STARTING_DOSE_CONCENTRATION,
                volume: STARTING_DOSE_VOLUME,
                scheduledAt: scheduledDate,
                immunotherapyId: immunotherapy.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                status: 'SCHEDULED',
                nextIntervalInDays: BUILD_UP_INTERVAL
            });

            // Administrar em data diferente (um dia antes)
            const dto = {
                concentration: STARTING_DOSE_CONCENTRATION,
                volume: STARTING_DOSE_VOLUME,
                administeredAt: new Date('2026-01-21T10:00:00')
            };

            const result = await registerAdministeredDoseUseCase.execute(scheduledDose.id, dto, authenticatedUser);

            expect(result).toBeDefined();
            expect(result.status).toBe(DoseStatus.ADMINISTERED_OFF_SCHEDULE);
            expect(result.administeredAt).toBeDefined();
        });
    });

    describe('Casos de erro', () => {
        it('deve lançar exceção quando dose não é encontrada', async () => {
            const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

            const dto = {
                concentration: 10000,
                volume: 0.1,
                administeredAt: new Date()
            };

            await expect(
                registerAdministeredDoseUseCase.execute(ulid(), dto, authenticatedUser)
            ).rejects.toThrow(DoseNotFoundException);
        });

        it('deve atualizar apenas campos fornecidos sem criar próxima dose quando não há dados de administração', async () => {
            const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();

            const patient = await factories.patients.create({
                primaryOrganizationId: authenticatedUser.activeOrgId,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id
            });

            const immunotherapy = await factories.immunotherapies.create({
                inductionStartDate: new Date('2026-01-15'),
                targetConcentration: 10,
                targetVolume: 0.5,
                responsiblePhysicianId: authenticatedUser.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                patientId: patient.id
            });

            const scheduledDose = await factories.doses.create({
                concentration: STARTING_DOSE_CONCENTRATION,
                volume: STARTING_DOSE_VOLUME,
                scheduledAt: new Date('2026-01-22'),
                immunotherapyId: immunotherapy.id,
                createdById: authenticatedUser.id,
                updatedById: authenticatedUser.id,
                status: 'SCHEDULED',
                nextIntervalInDays: BUILD_UP_INTERVAL
            });

            const dto = {
                notes: "Apenas atualizando notas"
                // Sem administeredAt - não deve criar próxima dose
            };

            const result = await registerAdministeredDoseUseCase.execute(scheduledDose.id, dto, authenticatedUser);

            expect(result).toBeDefined();
            expect(result.notes).toBe(dto.notes);
            expect(result.status).toBe(DoseStatus.SCHEDULED); // Mantém como agendada
            expect(result.administeredAt).toBeNull(); // Não foi administrada

            // Verificar que nenhuma nova dose foi criada
            const dosesCount = await prisma.dose.count({
                where: {
                    immunotherapyId: immunotherapy.id
                }
            });

            expect(dosesCount).toBe(1); // Apenas a dose original
        });
    });
})