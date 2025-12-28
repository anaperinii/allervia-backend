import { forwardRef, Module } from '@nestjs/common';
import { IBuildUpPhase } from './allergen-immunotherapy/clinical-rules/build-up-phase/build-up-phase.interface';
import { IMaintenancePhase } from './allergen-immunotherapy/clinical-rules/maintenance-phase/maintenance-phase.interface';
import { MaintenancePhaseService } from './allergen-immunotherapy/clinical-rules/maintenance-phase/maintenance-phase.service';
import { RegisterStartingDoseUseCase } from './allergen-immunotherapy/clinical-rules/build-up-phase/register-starting-dose.use-case';
import { RegisterNextScheduledBuildUpUseCase } from './allergen-immunotherapy/clinical-rules/build-up-phase/register-scheduled-build-up.use-case';
import { RegisterNextScheduledMaintenanceUseCase } from './allergen-immunotherapy/clinical-rules/maintenance-phase/register-scheduled-maintenance.use-case';
import { BuildUpPhaseService } from './allergen-immunotherapy/clinical-rules/build-up-phase/build-up-phase.service';
import { CountDosesByConcentration } from './allergen-immunotherapy/dosing/use-cases/count-doses-by-concentration.use-case';
import { CountDosesByIntervalUseCase } from './allergen-immunotherapy/dosing/use-cases/count-doses-by-interval.use-case';
import { CreateDoseUseCase } from './allergen-immunotherapy/dosing/use-cases/create-dose.use-case';
import { FindDoseUseCase } from './allergen-immunotherapy/dosing/use-cases/find-dose.use-case';
import { ListDosesByTherapyUseCase } from './allergen-immunotherapy/dosing/use-cases/list-doses-by-therapy.use-case';
import { RegisterAdministeredDoseUseCase } from './allergen-immunotherapy/dosing/use-cases/register-administered-dose.use-case';
import { UpdateDoseStatusUseCase } from './allergen-immunotherapy/dosing/use-cases/update-dose-status.use-case';
import { IDoseRepository } from './allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface';
import { PrismaDoseRepository } from './allergen-immunotherapy/dosing/infrastructure/repositories/prisma-dose.repository';
import { DosesController } from './allergen-immunotherapy/dosing/controllers/doses.controller';
import { CreateImmunotherapyUseCase } from './allergen-immunotherapy/therapies/use-cases/create-immunotherapy.use-case';
import { FindImmunotherapyUseCase } from './allergen-immunotherapy/therapies/use-cases/find-immunotherapy.use-case';
import { ListAllImmunotherapiesUseCase } from './allergen-immunotherapy/therapies/use-cases/list-all-immunotherapies.use-case';
import { ListImmunotherapiesByTypeUseCase } from './allergen-immunotherapy/therapies/use-cases/list-immunotherapies-by-type.use-case';
import { ListImmunotherapiesForPatientUseCase } from './allergen-immunotherapy/therapies/use-cases/list-immunotherapies-for-patient.use-case';
import { UpdateImmunotherapyStatusUseCase } from './allergen-immunotherapy/therapies/use-cases/update-immunotherapy-status.use-case';
import { UpdateImmunotherapyUseCase } from './allergen-immunotherapy/therapies/use-cases/update-immunotherapy.use-case';
import { IImmunotherapyRepository } from './allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface';
import { PrismaImmunotherapyRepository } from './allergen-immunotherapy/therapies/infrastructure/repositories/prisma-immunotherapy.repository';
import { ImmunotherapiesController } from './allergen-immunotherapy/therapies/controllers/immunotherapies.controller';
import { PatientsModule } from 'src/patients/patients.module';
import { PrismaModule } from 'src/database/prisma.module';

@Module({
    providers: [
        RegisterStartingDoseUseCase,
        RegisterNextScheduledBuildUpUseCase,
        RegisterNextScheduledMaintenanceUseCase,
        CreateDoseUseCase,
        FindDoseUseCase,
        ListDosesByTherapyUseCase,
        RegisterAdministeredDoseUseCase,
        UpdateDoseStatusUseCase,
        CountDosesByConcentration,
        CountDosesByIntervalUseCase,
        CreateImmunotherapyUseCase,
        FindImmunotherapyUseCase,
        ListImmunotherapiesForPatientUseCase,
        ListImmunotherapiesByTypeUseCase,
        UpdateImmunotherapyUseCase,
        UpdateImmunotherapyStatusUseCase,
        ListAllImmunotherapiesUseCase,
        {
            provide: IBuildUpPhase,
            useClass: BuildUpPhaseService
        },
        {
            provide: IMaintenancePhase,
            useClass: MaintenancePhaseService
        },
        {
            provide: IDoseRepository,
            useClass: PrismaDoseRepository,
        },
        {
            provide: IImmunotherapyRepository,
            useClass: PrismaImmunotherapyRepository,
        },
    ],
    imports: [
        PatientsModule,
        PrismaModule
    ],
    exports: [IBuildUpPhase, IMaintenancePhase, IDoseRepository, CreateDoseUseCase, ListDosesByTherapyUseCase, CountDosesByConcentration, CountDosesByIntervalUseCase, IImmunotherapyRepository, CreateImmunotherapyUseCase, FindImmunotherapyUseCase],
    controllers: [DosesController, ImmunotherapiesController]
})
export class TreatmentProtocolsModule {}
