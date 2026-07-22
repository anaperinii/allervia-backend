import { Injectable } from '@nestjs/common';
import { PatientRepository } from '../patient.repository';
import { PatientNotFoundException } from '../exceptions/patient-not-found.exception';
import { UpdatePatientDto } from '../dtos/update-patient.dto';
import { PatientResponseDto } from '../dtos/patient-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class UpdatePatientUseCase {
  constructor(
    private patientRepository: PatientRepository
  ) {}

  async execute(
    id: string,
    dto: UpdatePatientDto,
    currentUser: AuthenticatedUserPayload,
    tx?: ITransactionContext
  ) {

    const patient = await this.patientRepository.findById(id, currentUser.activeOrgId);

    if (!patient) {
      throw new PatientNotFoundException(id);
    }

    const updatedPatient = await this.patientRepository.update(id, dto, tx);

    return updatedPatient;
  }
}

