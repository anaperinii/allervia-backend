import { forwardRef, Module } from '@nestjs/common';
import { DosesModule } from 'src/doses/doses.module';
import { ImmunotherapiesModule } from 'src/immunotherapies/immunotherapies.module';
import { IBuildUpPhase } from './allergen-immunotherapy/build-up-phase/build-up-phase.interface';
import { IMaintenancePhase } from './allergen-immunotherapy/maintenance-phase/maintenance-phase.interface';
import { BuildUpPhaseService } from './allergen-immunotherapy/build-up-phase/build-up-phase.service';
import { MaintenancePhaseService } from './allergen-immunotherapy/maintenance-phase/maintenance-phase.service';
import { RegisterStartingDoseUseCase } from './allergen-immunotherapy/build-up-phase/register-starting-dose.use-case';
import { RegisterNextScheduledBuildUpUseCase } from './allergen-immunotherapy/build-up-phase/register-scheduled-build-up.use-case';
import { RegisterNextScheduledMaintenanceUseCase } from './allergen-immunotherapy/maintenance-phase/register-scheduled-maintenance.use-case';

@Module({
    providers: [
        RegisterStartingDoseUseCase,
        RegisterNextScheduledBuildUpUseCase,
        RegisterNextScheduledMaintenanceUseCase,
        {
            provide: IBuildUpPhase,
            useClass: BuildUpPhaseService
        },
        {
            provide: IMaintenancePhase,
            useClass: MaintenancePhaseService
        }
    ],
    imports: [
        forwardRef(() => ImmunotherapiesModule),
        forwardRef(() => DosesModule)
    ],
    exports: [IBuildUpPhase, IMaintenancePhase]
})
export class TreatmentProtocolsModule {}
