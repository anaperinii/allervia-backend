import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma.module';
import { CreatePatientUseCase } from './use-cases/create-patient.use-case';
import { FindPatientUseCase } from './use-cases/find-patient.use-case';
import { ListPatientsUseCase } from './use-cases/list-patients.use-case';
import { UpdatePatientUseCase } from './use-cases/update-patient.use-case';
import { UpdatePatientStatusUseCase } from './use-cases/update-patient-status.use-case';
import { IPatientRepository } from './domain/interfaces/patient.repository.interface';
import { PrismaPatientRepository } from './infrastructure/persistence/prisma-patient.repository';
import { PatientsController } from './controllers/patients.controller';

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
