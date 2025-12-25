import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma/prisma.module';
import { CreatePatientUseCase } from './application/use-cases/create-patient.use-case';
import { FindPatientUseCase } from './application/use-cases/find-patient.use-case';
import { ListPatientsUseCase } from './application/use-cases/list-patients.use-case';
import { UpdatePatientUseCase } from './application/use-cases/update-patient.use-case';
import { UpdatePatientStatusUseCase } from './application/use-cases/update-patient-status.use-case';
import { IPatientRepository } from './domain/contracts/patient.repository.interface';
import { PrismaPatientRepository } from './infrastructure/persistence/prisma-patient.repository';
import { PatientsController } from './presentation/controllers/patients.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PatientsController],
  providers: [
    // Use Cases
    CreatePatientUseCase,
    FindPatientUseCase,
    ListPatientsUseCase,
    UpdatePatientUseCase,
    UpdatePatientStatusUseCase,

    // Repositories
    {
      provide: IPatientRepository,
      useClass: PrismaPatientRepository,
    },
  ],
  exports: [IPatientRepository, CreatePatientUseCase, FindPatientUseCase],
})
export class PatientsModule {}
