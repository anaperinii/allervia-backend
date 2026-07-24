import { Injectable, NotFoundException } from '@nestjs/common';
import { PatientRepository } from 'src/patients/patient.repository';
import { PATIENT_MESSAGES } from 'src/patients/patient.messages';
import { UpdatePatientDto } from 'src/patients/dtos/update-patient.dto';
import { PatientResponseDto } from 'src/patients/dtos/patient-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { Prisma } from '@prisma/client';

@Injectable()
export class UpdatePatientUseCase {
  constructor(
    private patientRepository: PatientRepository
  ) {}

  async execute(
    id: string,
    dto: UpdatePatientDto,
    currentUser: AuthenticatedUserPayload
  ) {

    const patient = await this.patientRepository.findById(id, currentUser.activeOrgId);

    if (!patient) {
      throw new NotFoundException(PATIENT_MESSAGES.notFound(id));
    }

    const updatedPatient = await this.patientRepository.update(id, dto);

    return updatedPatient;
  }
}

