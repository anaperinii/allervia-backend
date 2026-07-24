import { Injectable } from '@nestjs/common';
import { PatientRepository } from '../patient.repository';
import { PatientResponseDto } from '../dtos/patient-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ListPatientsUseCase {
  constructor(
    private patientRepository: PatientRepository,
  ) {}

  async execute(organizationId: string) {
    const patients = await this.patientRepository.findByOrganization(organizationId);
    return patients;
  }
}

