import { Injectable, NotFoundException } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { IImmunotherapyRepository } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface';
import { UpdateImmunotherapyStatusDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/update-immunotherapy-status.dto';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ImmunotherapyResponseDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/immunotherapy-response.dto';
import { IMMUNOTHERAPY_MESSAGES } from 'src/treatment-protocols/allergen-immunotherapy/therapies/immunotherapy.messages';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';

@Injectable()
export class UpdateImmunotherapyStatusUseCase {
  constructor(
    private readonly immunotherapyRepository: IImmunotherapyRepository,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async execute(
    id: string,
    dto: UpdateImmunotherapyStatusDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyResponseDto> {
    const ability = this.abilityFactory.createForUser(currentUser);
    const where = accessibleBy(ability, 'update').ofType('Immunotherapy');

    const immunotherapy = await this.immunotherapyRepository.findByIdAccessible(
      id,
      where,
    );

    if (!immunotherapy) {
      throw new NotFoundException(IMMUNOTHERAPY_MESSAGES.notFound(id));
    }

    immunotherapy.updateStatus(dto.status, currentUser.id);

    return this.immunotherapyRepository.update(immunotherapy.id, immunotherapy);
  }
}
