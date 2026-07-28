import { Injectable } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { IImmunotherapyRepository } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface';
import { ImmunotherapyResponseDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/immunotherapy-response.dto';
import { Immunotherapy } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/entities/immunotherapy.entity';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

@Injectable()
export class ListImmunotherapiesByTypeUseCase {
  constructor(
    private readonly immunotherapyRepository: IImmunotherapyRepository,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async execute(
    type: string,
    currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyResponseDto[]> {
    const ability = this.abilityFactory.createForUser(currentUser);
    const where = accessibleBy(ability, 'read').ofType('Immunotherapy');

    const immunotherapies =
      await this.immunotherapyRepository.findByTypeAccessible(type, where);

    return immunotherapies.map(
      (immunotherapy) => new Immunotherapy(immunotherapy),
    );
  }
}
