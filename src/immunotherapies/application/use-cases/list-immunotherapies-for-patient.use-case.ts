import { Injectable } from "@nestjs/common";
import { IImmunotherapyRepository } from "../../domain/contracts/immunotherapy.repository.interface";
import { ImmunotherapyResponseDto } from "../dtos/immunotherapy-response.dto";
import { Immunotherapy } from "src/immunotherapies/domain/entities/immunotherapy.entity";

@Injectable()
export class ListImmunotherapiesForPatientUseCase {
  constructor(
    private readonly immunotherapyRepository: IImmunotherapyRepository
  ) {}

  async execute(patientId: string, organizationId: string): Promise<ImmunotherapyResponseDto[]> {
    const immunotherapies = await this.immunotherapyRepository.findByPatient(patientId, organizationId);
    return immunotherapies.map(immunotherapy => new Immunotherapy(immunotherapy));
  }
}

