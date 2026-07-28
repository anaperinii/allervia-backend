import { Injectable } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { IImmunotherapyRepository } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

@Injectable()
export class ListAllImmunotherapiesUseCase {
  constructor(
    private immunoRepository: IImmunotherapyRepository,
    private abilityFactory: AbilityFactory,
  ) {}

  async execute(currentUser: AuthenticatedUserPayload) {
    const ability = this.abilityFactory.createForUser(currentUser);
    const where = accessibleBy(ability, 'read').ofType('Immunotherapy');

    return this.immunoRepository.findAllAccessible(where);
  }
}
