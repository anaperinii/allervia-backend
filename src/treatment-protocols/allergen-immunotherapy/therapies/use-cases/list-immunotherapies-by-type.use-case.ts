import { Injectable } from "@nestjs/common";
import { IImmunotherapyRepository } from "src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface";
import { ImmunotherapyResponseDto } from "src/treatment-protocols/allergen-immunotherapy/therapies/dtos/immunotherapy-response.dto";
import { Immunotherapy } from "src/treatment-protocols/allergen-immunotherapy/therapies/domain/entities/immunotherapy.entity";

@Injectable()
export class ListImmunotherapiesByTypeUseCase {
  constructor(
    private readonly immunotherapyRepository: IImmunotherapyRepository
  ) {}

  async execute(type: string, organizationId: string): Promise<ImmunotherapyResponseDto[]> {
    const immunotherapies = await this.immunotherapyRepository.findByType(type, organizationId);
    return immunotherapies.map(immunotherapy => new Immunotherapy(immunotherapy));
  }
}


