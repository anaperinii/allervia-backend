import { ProtocolMigrationService } from './allergen-immunotherapy/protocol-catalog/protocol-migration.service';
import { ProtocolCatalogService } from './allergen-immunotherapy/protocol-catalog/protocol-catalog.service';
import { ProtocolCatalogController } from './allergen-immunotherapy/protocol-catalog/protocol-catalog.controller';
import { ConfiguredDoseService } from './allergen-immunotherapy/dosing/configured-dose.service';
import { ClinicalScheduleService } from './allergen-immunotherapy/dosing/clinical-schedule.service';
import { TherapyLifecycleService } from './allergen-immunotherapy/therapies/therapy-lifecycle.service';
import { PrescriptionRevisionService } from './allergen-immunotherapy/therapies/prescription-revision.service';
import { DoseCorrectionService } from './allergen-immunotherapy/dosing/dose-correction.service';
import { UpdateScheduledDoseUseCase } from './allergen-immunotherapy/dosing/use-cases/update-scheduled-dose.use-case';
import { Module } from '@nestjs/common';
import { ReadDoseUseCase } from './allergen-immunotherapy/dosing/use-cases/read-dose.use-case';
import { ListDosesByTherapyUseCase } from './allergen-immunotherapy/dosing/use-cases/list-doses-by-therapy.use-case';
import { RegisterAdministeredDoseUseCase } from './allergen-immunotherapy/dosing/use-cases/register-administered-dose.use-case';
import { UpdateDoseStatusUseCase } from './allergen-immunotherapy/dosing/use-cases/update-dose-status.use-case';
import { IDoseRepository } from './allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface';
import { PrismaDoseRepository } from './allergen-immunotherapy/dosing/prisma-dose.repository';
import { DosesController } from './allergen-immunotherapy/dosing/doses.controller';
import { CreateImmunotherapyUseCase } from './allergen-immunotherapy/therapies/use-cases/create-immunotherapy.use-case';
import { FindImmunotherapyUseCase } from './allergen-immunotherapy/therapies/use-cases/find-immunotherapy.use-case';
import { ReadImmunotherapyUseCase } from './allergen-immunotherapy/therapies/use-cases/read-immunotherapy.use-case';
import { ListAllImmunotherapiesUseCase } from './allergen-immunotherapy/therapies/use-cases/list-all-immunotherapies.use-case';
import { ListImmunotherapiesByTypeUseCase } from './allergen-immunotherapy/therapies/use-cases/list-immunotherapies-by-type.use-case';
import { ListImmunotherapiesForPatientUseCase } from './allergen-immunotherapy/therapies/use-cases/list-immunotherapies-for-patient.use-case';
import { UpdateImmunotherapyStatusUseCase } from './allergen-immunotherapy/therapies/use-cases/update-immunotherapy-status.use-case';
import { UpdateImmunotherapyUseCase } from './allergen-immunotherapy/therapies/use-cases/update-immunotherapy.use-case';
import { IImmunotherapyRepository } from './allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface';
import { PrismaImmunotherapyRepository } from './allergen-immunotherapy/therapies/prisma-immunotherapy.repository';
import { ImmunotherapiesController } from './allergen-immunotherapy/therapies/immunotherapies.controller';
import { PatientsModule } from 'src/patients/patients.module';
import { AuditModule } from 'src/infra/audit/audit.module';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { PermissionsModule } from 'src/security/permissions/permissions.module';

@Module({
  providers: [
    ProtocolCatalogService,
    ProtocolMigrationService,
    ConfiguredDoseService,
    ClinicalScheduleService,
    TherapyLifecycleService,
    PrescriptionRevisionService,
    DoseCorrectionService,
    UpdateScheduledDoseUseCase,
    ReadDoseUseCase,
    ListDosesByTherapyUseCase,
    RegisterAdministeredDoseUseCase,
    UpdateDoseStatusUseCase,
    CreateImmunotherapyUseCase,
    FindImmunotherapyUseCase,
    ReadImmunotherapyUseCase,
    ListImmunotherapiesForPatientUseCase,
    ListImmunotherapiesByTypeUseCase,
    UpdateImmunotherapyUseCase,
    UpdateImmunotherapyStatusUseCase,
    ListAllImmunotherapiesUseCase,
    {
      provide: IDoseRepository,
      useClass: PrismaDoseRepository,
    },
    {
      provide: IImmunotherapyRepository,
      useClass: PrismaImmunotherapyRepository,
    },
  ],
  imports: [PatientsModule, PrismaModule, AuditModule, PermissionsModule],
  exports: [
    IDoseRepository,
    ListDosesByTherapyUseCase,
    IImmunotherapyRepository,
    CreateImmunotherapyUseCase,
    FindImmunotherapyUseCase,
  ],
  controllers: [
    DosesController,
    ImmunotherapiesController,
    ProtocolCatalogController,
  ],
})
export class TreatmentProtocolsModule {}
