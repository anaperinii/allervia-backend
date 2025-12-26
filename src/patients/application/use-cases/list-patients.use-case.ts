import { Injectable } from '@nestjs/common';
import { IPatientRepository } from '../../domain/contracts/patient.repository.interface';
import { PatientResponseDto } from '../dtos/patient-response.dto';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class ListPatientsUseCase {
  constructor(
    private patientRepository: IPatientRepository,
  ) {}

  async execute(organizationId: string, tx?: ITransactionContext): Promise<PatientResponseDto[]> {
    const patients = await this.patientRepository.findByOrganization(organizationId, tx);
    return patients;
  }
}

