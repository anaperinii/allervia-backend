import { Injectable } from "@nestjs/common";
import { IImmunotherapyRepository } from "../../domain/contracts/immunotherapy.repository.interface";
import { UpdateImmunotherapyDto } from "../dtos/update-immunotherapy.dto";
import { ImmunotherapyResponseDto } from "../dtos/immunotherapy-response.dto";
import { ImmunotherapyNotFoundException } from "../../domain/exceptions/immunotherapy-not-found.exception";

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
      throw new ImmunotherapyNotFoundException(id);
    }

    const updatedImmunotherapy = await this.immunotherapyRepository.update(immunotherapy.id, dto); 

    return updatedImmunotherapy;
  }
}

