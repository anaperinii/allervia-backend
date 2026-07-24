import { Injectable, NotFoundException } from '@nestjs/common';
import { PatientRepository } from 'src/patients/patient.repository';
import { PATIENT_MESSAGES } from 'src/patients/patient.messages';
import { UpdatePatientStatusDto } from 'src/patients/dtos/update-patient-status.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';

@Injectable()
export class UpdatePatientStatusUseCase {
  constructor(private patientRepository: PatientRepository) {}

  async execute(
    id: string,
    dto: UpdatePatientStatusDto,
    currentUser: AuthenticatedUserPayload,
  ) {
    const patient = await this.patientRepository.findById(
      id,
      currentUser.activeOrgId,
    );

    if (!patient) {
      throw new NotFoundException(PATIENT_MESSAGES.notFound(id));
    }

    const savedPatient = await this.patientRepository.update(
      patient.id,
      patient,
    );

    return savedPatient;
  }
}
