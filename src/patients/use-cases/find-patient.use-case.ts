import { Injectable, NotFoundException } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { PatientRepository } from 'src/patients/patient.repository';
import { PATIENT_MESSAGES } from 'src/patients/patient.messages';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

@Injectable()
export class FindPatientUseCase {
  constructor(
    private patientRepository: PatientRepository,
    private abilityFactory: AbilityFactory,
  ) {}

  async execute(id: string, currentUser: AuthenticatedUserPayload) {
    const ability = this.abilityFactory.createForUser(currentUser);
    const where = accessibleBy(ability, 'read').ofType('Patient');

    const patient = await this.patientRepository.findByIdAccessible(id, where);

    if (!patient) {
      throw new NotFoundException(PATIENT_MESSAGES.notFound(id));
    }

    return patient;
  }
}
