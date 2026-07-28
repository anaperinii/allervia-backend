import { Injectable } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { PatientRepository } from 'src/patients/patient.repository';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

@Injectable()
export class ListPatientsUseCase {
  constructor(
    private patientRepository: PatientRepository,
    private abilityFactory: AbilityFactory,
  ) {}

  async execute(currentUser: AuthenticatedUserPayload) {
    const ability = this.abilityFactory.createForUser(currentUser);
    const where = accessibleBy(ability, 'read').ofType('Patient');

    return this.patientRepository.findAccessible(where);
  }
}
