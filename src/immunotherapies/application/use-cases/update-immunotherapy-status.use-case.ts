import { Injectable } from "@nestjs/common";
import { IImmunotherapyRepository } from "../../domain/contracts/immunotherapy.repository.interface";
import { UpdateImmunotherapyStatusDto } from "../dtos/update-immunotherapy-status.dto";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { ImmunotherapyResponseDto } from "../dtos/immunotherapy-response.dto";
import { ImmunotherapyNotFoundException } from "../../domain/exceptions/immunotherapy-not-found.exception";

@Injectable()
export class UpdateImmunotherapyStatusUseCase {
  constructor(
    private readonly immunotherapyRepository: IImmunotherapyRepository
  ) {}

  async execute(
    id: string,
    dto: UpdateImmunotherapyStatusDto,
    organizationId: string,
    currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyResponseDto> {
    
    const immunotherapy = await this.immunotherapyRepository.findById(id, organizationId);

    if (!immunotherapy) {
      throw new ImmunotherapyNotFoundException(id);
    }

    immunotherapy.updateStatus(dto.status, currentUser.id);

    const updatedImmunotherapy = await this.immunotherapyRepository.update(immunotherapy.id, immunotherapy);

    return updatedImmunotherapy;
  }
}

