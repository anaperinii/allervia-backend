import { Injectable } from '@nestjs/common';
import { IPatientRepository } from '../domain/interfaces/patient.repository.interface';
import { PatientNotFoundException } from '../domain/exceptions/patient-not-found.exception';
import { UpdatePatientStatusDto } from '../dtos/update-patient-status.dto';
import { PatientResponseDto } from '../dtos/patient-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class UpdatePatientStatusUseCase {
  constructor(
    private patientRepository: IPatientRepository
  ) {}

  async execute(
    id: string,
    dto: UpdatePatientStatusDto,
    currentUser: AuthenticatedUserPayload,
    tx?: ITransactionContext
  ): Promise<PatientResponseDto> {

    const patient = await this.patientRepository.findById(id, currentUser.activeOrgId);

    if (!patient) {
      throw new PatientNotFoundException(id);
    }

    dto.status === true ? patient.activate() : patient.deactivate();
    
    const savedPatient = await this.patientRepository.update(patient.id, patient, tx);

    return savedPatient;
  }
}

