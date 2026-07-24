import { Injectable, NotFoundException } from "@nestjs/common";
import { IImmunotherapyRepository } from "src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface";
import { UpdateImmunotherapyDto } from "src/treatment-protocols/allergen-immunotherapy/therapies/dtos/update-immunotherapy.dto";
import { ImmunotherapyResponseDto } from "src/treatment-protocols/allergen-immunotherapy/therapies/dtos/immunotherapy-response.dto";
import { IMMUNOTHERAPY_MESSAGES } from "src/treatment-protocols/allergen-immunotherapy/therapies/immunotherapy.messages";

@Injectable()
export class UpdateImmunotherapyUseCase {
  constructor(
    private readonly immunotherapyRepository: IImmunotherapyRepository
  ) {}

  async execute(
    id: string,
    dto: UpdateImmunotherapyDto,
    organizationId: string
  ): Promise<ImmunotherapyResponseDto> {
    const immunotherapy = await this.immunotherapyRepository.findById(id, organizationId);

    if (!immunotherapy) {
      throw new NotFoundException(IMMUNOTHERAPY_MESSAGES.notFound(id));
    }

    const updatedImmunotherapy = await this.immunotherapyRepository.update(immunotherapy.id, dto); 

    return updatedImmunotherapy;
  }
}

