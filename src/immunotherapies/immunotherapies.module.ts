import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma/prisma.module';
import { PatientsModule } from 'src/patients/patients.module';
import { ImmunotherapiesController } from './presentation/controllers/immunotherapies.controller';
import { DosesModule } from 'src/doses/doses.module';
import { IImmunotherapyRepository } from './domain/contracts/immunotherapy.repository.interface';
import { PrismaImmunotherapyRepository } from './infrastructure/persistence/prisma-immunotherapy.repository';
import { CreateImmunotherapyUseCase } from './application/use-cases/create-immunotherapy.use-case';
import { FindImmunotherapyUseCase } from './application/use-cases/find-immunotherapy.use-case';
import { ListImmunotherapiesForPatientUseCase } from './application/use-cases/list-immunotherapies-for-patient.use-case';
import { ListImmunotherapiesByTypeUseCase } from './application/use-cases/list-immunotherapies-by-type.use-case';
import { UpdateImmunotherapyUseCase } from './application/use-cases/update-immunotherapy.use-case';
import { UpdateImmunotherapyStatusUseCase } from './application/use-cases/update-immunotherapy-status.use-case';
import { ListAllImmunotherapiesUseCase } from './application/use-cases/list-all-immunotherapies.use-case';
import { TreatmentProtocolsModule } from 'src/treatment-protocols/treatment-protocols.module';

@Module({
  providers: [
    // Use Cases
    CreateImmunotherapyUseCase,
    FindImmunotherapyUseCase,
    ListImmunotherapiesForPatientUseCase,
    ListImmunotherapiesByTypeUseCase,
    UpdateImmunotherapyUseCase,
    UpdateImmunotherapyStatusUseCase,
    ListAllImmunotherapiesUseCase,

    // Repositories
    {
      provide: IImmunotherapyRepository,
      useClass: PrismaImmunotherapyRepository,
    },
  ],
  imports: [PrismaModule, PatientsModule, forwardRef(() => DosesModule), forwardRef(() => TreatmentProtocolsModule)],
  exports: [IImmunotherapyRepository, CreateImmunotherapyUseCase, FindImmunotherapyUseCase],
  controllers: [ImmunotherapiesController],
})
export class ImmunotherapiesModule {}
