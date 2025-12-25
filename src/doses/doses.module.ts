import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma/prisma.module';
import { ImmunotherapiesModule } from 'src/immunotherapies/immunotherapies.module';
import { CreateDoseUseCase } from './application/use-cases/create-dose.use-case';
import { FindDoseUseCase } from './application/use-cases/find-dose.use-case';
import { ListDosesByTherapyUseCase } from './application/use-cases/list-doses-by-therapy.use-case';
import { UpdateDoseUseCase } from './application/use-cases/update-dose.use-case';
import { UpdateDoseStatusUseCase } from './application/use-cases/update-dose-status.use-case';
import { IDoseRepository } from './domain/contracts/dose.repository.interface';
import { PrismaDoseRepository } from './infrastructure/persistence/prisma-dose.repository';
import { DosesController } from './presentation/controllers/doses.controller';

@Module({
  imports: [PrismaModule, forwardRef(() => ImmunotherapiesModule)],
  controllers: [DosesController],
  providers: [
    // Use Cases
    CreateDoseUseCase,
    FindDoseUseCase,
    ListDosesByTherapyUseCase,
    UpdateDoseUseCase,
    UpdateDoseStatusUseCase,

    // Repositories
    {
      provide: IDoseRepository,
      useClass: PrismaDoseRepository,
    },
  ],
  exports: [IDoseRepository, CreateDoseUseCase, ListDosesByTherapyUseCase],
})
export class DosesModule {}
