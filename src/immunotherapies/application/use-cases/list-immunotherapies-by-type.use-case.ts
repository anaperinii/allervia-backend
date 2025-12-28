import { Injectable } from "@nestjs/common";
import { IImmunotherapyRepository } from "../../domain/contracts/immunotherapy.repository.interface";
import { ImmunotherapyResponseDto } from "../dtos/immunotherapy-response.dto";
import { Immunotherapy } from "src/immunotherapies/domain/entities/immunotherapy.entity";

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


