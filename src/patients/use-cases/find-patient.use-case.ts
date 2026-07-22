import { Injectable } from '@nestjs/common';
import { PatientRepository } from '../patient.repository';
import { PatientNotFoundException } from '../exceptions/patient-not-found.exception';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class FindPatientUseCase {
  constructor(
    private patientRepository: PatientRepository
  ) {}

  async execute(id: string, organizationId: string, tx?: ITransactionContext) {

    const patient = await this.patientRepository.findById(id, organizationId, tx);

    if (!patient) {
      throw new PatientNotFoundException(id);
    }

    return patient;
  }
}

