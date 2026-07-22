import { Injectable } from '@nestjs/common';
import { PatientRepository } from '../patient.repository';
import { CreatePatientDto } from '../dtos/create-patient.dto';
import { PatientResponseDto } from '../dtos/patient-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class CreatePatientUseCase {
  constructor(
    private patientRepository: PatientRepository
  ) {}

  async execute(
    dto: CreatePatientDto,
    currentUser: AuthenticatedUserPayload,
    tx?: ITransactionContext
  ) {
   
    const savedPatient = await this.patientRepository.create(dto, tx);
    
    return savedPatient;
  }
}


