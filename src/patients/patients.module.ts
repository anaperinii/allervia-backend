import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { CreatePatientUseCase } from './use-cases/create-patient.use-case';
import { FindPatientUseCase } from './use-cases/find-patient.use-case';
import { ListPatientsUseCase } from './use-cases/list-patients.use-case';
import { UpdatePatientUseCase } from './use-cases/update-patient.use-case';
import { UpdatePatientStatusUseCase } from './use-cases/update-patient-status.use-case';
import { PatientRepository } from './patient.repository';
import { PrismaPatientRepository } from './prisma-patient.repository';
import { PatientsController } from './patients.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PatientsController],
  providers: [
    CreatePatientUseCase,
    FindPatientUseCase,
    ListPatientsUseCase,
    UpdatePatientUseCase,
    UpdatePatientStatusUseCase,
    {
      provide: PatientRepository,
      useClass: PrismaPatientRepository,
    },
  ],
  exports: [PatientRepository, CreatePatientUseCase, FindPatientUseCase],
})
export class PatientsModule {}
