import { Injectable } from '@nestjs/common';
import { IPatientRepository } from '../../domain/contracts/patient.repository.interface';
import { PatientNotFoundException } from '../../domain/exceptions/patient-not-found.exception';
import { Patient } from 'src/patients/domain/entities/patient.entity';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class FindPatientUseCase {
  constructor(
    private patientRepository: IPatientRepository
  ) {}

  async execute(id: string, organizationId: string, tx?: ITransactionContext): Promise<Patient> {

    const patient = await this.patientRepository.findById(id, organizationId, tx);

    if (!patient) {
      throw new PatientNotFoundException(id);
    }

    return patient;
  }
}

