import { Injectable, NotFoundException } from '@nestjs/common';
import { IImmunotherapyRepository } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface';
import { UpdateImmunotherapyStatusDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/update-immunotherapy-status.dto';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ImmunotherapyResponseDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/immunotherapy-response.dto';
import { IMMUNOTHERAPY_MESSAGES } from 'src/treatment-protocols/allergen-immunotherapy/therapies/immunotherapy.messages';

@Injectable()
export class UpdateImmunotherapyStatusUseCase {
  constructor(
    private readonly immunotherapyRepository: IImmunotherapyRepository,
  ) {}

  async execute(
    id: string,
    dto: UpdateImmunotherapyStatusDto,
    organizationId: string,
    currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyResponseDto> {
    const immunotherapy = await this.immunotherapyRepository.findById(
      id,
      organizationId,
    );

    if (!immunotherapy) {
      throw new NotFoundException(IMMUNOTHERAPY_MESSAGES.notFound(id));
    }

    immunotherapy.updateStatus(dto.status, currentUser.id);

    const updatedImmunotherapy = await this.immunotherapyRepository.update(
      immunotherapy.id,
      immunotherapy,
    );

    return updatedImmunotherapy;
  }
}
