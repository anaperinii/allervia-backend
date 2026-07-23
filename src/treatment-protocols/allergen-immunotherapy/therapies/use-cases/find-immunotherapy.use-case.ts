import { Injectable, NotFoundException } from "@nestjs/common";
import { IImmunotherapyRepository } from "../domain/interfaces/immunotherapy.repository.interface";
import { ImmunotherapyResponseDto } from "../dtos/immunotherapy-response.dto";
import { IMMUNOTHERAPY_MESSAGES } from "../immunotherapy.messages";

@Injectable()
export class FindImmunotherapyUseCase {
  constructor(
    private readonly immunotherapyRepository: IImmunotherapyRepository
  ) {}

  async execute(id: string, organizationId: string): Promise<ImmunotherapyResponseDto> {
    const immunotherapy = await this.immunotherapyRepository.findById(id, organizationId);

    if (!immunotherapy) {
      throw new NotFoundException(IMMUNOTHERAPY_MESSAGES.notFound(id));
    }

    return immunotherapy;
  }
}


