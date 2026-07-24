import { Injectable, NotFoundException } from '@nestjs/common';
import { PatientRepository } from 'src/patients/patient.repository';
import { PATIENT_MESSAGES } from 'src/patients/patient.messages';
import { Prisma } from '@prisma/client';

@Injectable()
export class FindPatientUseCase {
  constructor(
    private patientRepository: PatientRepository
  ) {}

  async execute(id: string, organizationId: string) {

    const patient = await this.patientRepository.findById(id, organizationId);

    if (!patient) {
      throw new NotFoundException(PATIENT_MESSAGES.notFound(id));
    }

    return patient;
  }
}

