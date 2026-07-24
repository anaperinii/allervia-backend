import { Injectable, NotFoundException } from '@nestjs/common';
import { PatientRepository } from '../patient.repository';
import { PATIENT_MESSAGES } from '../patient.messages';
import { UpdatePatientStatusDto } from '../dtos/update-patient-status.dto';
import { PatientResponseDto } from '../dtos/patient-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { Prisma } from '@prisma/client';

@Injectable()
export class UpdatePatientStatusUseCase {
  constructor(
    private patientRepository: PatientRepository
  ) {}

  async execute(
    id: string,
    dto: UpdatePatientStatusDto,
    currentUser: AuthenticatedUserPayload
  ) {

    const patient = await this.patientRepository.findById(id, currentUser.activeOrgId);

    if (!patient) {
      throw new NotFoundException(PATIENT_MESSAGES.notFound(id));
    }
    
    const savedPatient = await this.patientRepository.update(patient.id, patient);

    return savedPatient;
  }
}

