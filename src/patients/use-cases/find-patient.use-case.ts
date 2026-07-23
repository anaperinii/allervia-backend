import { Injectable, NotFoundException } from '@nestjs/common';
import { PatientRepository } from '../patient.repository';
import { PATIENT_MESSAGES } from '../patient.messages';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class FindPatientUseCase {
  constructor(
    private patientRepository: PatientRepository
  ) {}

  async execute(id: string, organizationId: string, tx?: ITransactionContext) {

    const patient = await this.patientRepository.findById(id, organizationId, tx);

    if (!patient) {
      throw new NotFoundException(PATIENT_MESSAGES.notFound(id));
    }

    return patient;
  }
}

