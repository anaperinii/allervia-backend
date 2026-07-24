import { Injectable } from '@nestjs/common';
import { PatientRepository } from 'src/patients/patient.repository';

@Injectable()
export class ListPatientsUseCase {
  constructor(private patientRepository: PatientRepository) {}

  async execute(organizationId: string) {
    const patients =
      await this.patientRepository.findByOrganization(organizationId);
    return patients;
  }
}
