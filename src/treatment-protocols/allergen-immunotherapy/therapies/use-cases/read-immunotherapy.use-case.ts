import { Injectable, NotFoundException } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { IImmunotherapyRepository } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface';
import { ImmunotherapyResponseDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/immunotherapy-response.dto';
import { IMMUNOTHERAPY_MESSAGES } from 'src/treatment-protocols/allergen-immunotherapy/therapies/immunotherapy.messages';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

@Injectable()
export class ReadImmunotherapyUseCase {
  constructor(
    private readonly immunotherapyRepository: IImmunotherapyRepository,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async execute(
    id: string,
    currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyResponseDto> {
    const ability = this.abilityFactory.createForUser(currentUser);
    const where = accessibleBy(ability, 'read').ofType('Immunotherapy');

    const immunotherapy = await this.immunotherapyRepository.findByIdAccessible(
      id,
      where,
    );

    if (!immunotherapy) {
      throw new NotFoundException(IMMUNOTHERAPY_MESSAGES.notFound(id));
    }

    return immunotherapy;
  }
}
