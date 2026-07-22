import { Injectable } from '@nestjs/common';
import { PatientRepository } from '../patient.repository';
import { PatientResponseDto } from '../dtos/patient-response.dto';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class ListPatientsUseCase {
  constructor(
    private patientRepository: PatientRepository,
  ) {}

  async execute(organizationId: string, tx?: ITransactionContext) {
    const patients = await this.patientRepository.findByOrganization(organizationId, tx);
    return patients;
  }
}

