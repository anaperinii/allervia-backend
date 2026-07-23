import { Injectable, NotFoundException } from "@nestjs/common";
import { IImmunotherapyRepository } from "../domain/interfaces/immunotherapy.repository.interface";
import { UpdateImmunotherapyDto } from "../dtos/update-immunotherapy.dto";
import { ImmunotherapyResponseDto } from "../dtos/immunotherapy-response.dto";
import { IMMUNOTHERAPY_MESSAGES } from "../immunotherapy.messages";

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

