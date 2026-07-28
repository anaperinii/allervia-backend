import { Injectable, NotFoundException } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { IDoseRepository } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface';
import { DOSE_MESSAGES } from 'src/treatment-protocols/allergen-immunotherapy/dosing/dose.messages';
import { Dose } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/entities/dose.entity';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

@Injectable()
export class ReadDoseUseCase {
  constructor(
    private readonly doseRepository: IDoseRepository,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async execute(
    id: string,
    currentUser: AuthenticatedUserPayload,
  ): Promise<Dose> {
    const ability = this.abilityFactory.createForUser(currentUser);
    const where = accessibleBy(ability, 'read').ofType('Dose');

    const dose = await this.doseRepository.findByIdAccessible(id, where);

    if (!dose) {
      throw new NotFoundException(DOSE_MESSAGES.notFound(id));
    }

    return dose;
  }
}
