import { Injectable } from '@nestjs/common';
import { IPatientRepository } from '../../domain/contracts/patient.repository.interface';
import { PatientResponseDto } from '../dtos/patient-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ListPatientsUseCase {
  constructor(
    private patientRepository: IPatientRepository,
  ) {}

  async execute(organizationId: string, tx?: Prisma.TransactionClient): Promise<PatientResponseDto[]> {
    const patients = await this.patientRepository.findByOrganization(organizationId, tx);
    return patients;
  }
}

