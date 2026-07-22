import { Injectable } from '@nestjs/common';
import { PatientRepository } from '../patient.repository';
import { PatientNotFoundException } from '../exceptions/patient-not-found.exception';
import { UpdatePatientStatusDto } from '../dtos/update-patient-status.dto';
import { PatientResponseDto } from '../dtos/patient-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class UpdatePatientStatusUseCase {
  constructor(
    private patientRepository: PatientRepository
  ) {}

  async execute(
    id: string,
    dto: UpdatePatientStatusDto,
    currentUser: AuthenticatedUserPayload,
    tx?: ITransactionContext
  ) {

    const patient = await this.patientRepository.findById(id, currentUser.activeOrgId);

    if (!patient) {
      throw new PatientNotFoundException(id);
    }
    
    const savedPatient = await this.patientRepository.update(patient.id, patient, tx);

    return savedPatient;
  }
}

