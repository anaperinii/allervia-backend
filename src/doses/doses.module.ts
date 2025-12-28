import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma/prisma.module';
import { ImmunotherapiesModule } from 'src/immunotherapies/immunotherapies.module';
import { CreateDoseUseCase } from './application/use-cases/create-dose.use-case';
import { FindDoseUseCase } from './application/use-cases/find-dose.use-case';
import { ListDosesByTherapyUseCase } from './application/use-cases/list-doses-by-therapy.use-case';
import { RegisterAdministeredDoseUseCase } from './application/use-cases/register-administered-dose.use-case';
import { UpdateDoseStatusUseCase } from './application/use-cases/update-dose-status.use-case';
import { IDoseRepository } from './domain/contracts/dose.repository.interface';
import { PrismaDoseRepository } from './infrastructure/persistence/prisma-dose.repository';
import { DosesController } from './presentation/controllers/doses.controller';
import { CountDosesByConcentration } from './application/use-cases/count-doses-by-concentration.use-case';
import { CountDosesByIntervalUseCase } from './application/use-cases/count-doses-by-interval.use-case';
import { TreatmentProtocolsModule } from 'src/treatment-protocols/treatment-protocols.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ImmunotherapiesModule), forwardRef(() => TreatmentProtocolsModule)],
  controllers: [DosesController],
  providers: [
    // Use Cases
    CreateDoseUseCase,
    FindDoseUseCase,
    ListDosesByTherapyUseCase,
    RegisterAdministeredDoseUseCase,
    UpdateDoseStatusUseCase,
    CountDosesByConcentration,
    CountDosesByIntervalUseCase,

    // Repositories
    {
      provide: IDoseRepository,
      useClass: PrismaDoseRepository,
    },
  ],
  exports: [IDoseRepository, CreateDoseUseCase, ListDosesByTherapyUseCase, CountDosesByConcentration, CountDosesByIntervalUseCase],
})
export class DosesModule {}
