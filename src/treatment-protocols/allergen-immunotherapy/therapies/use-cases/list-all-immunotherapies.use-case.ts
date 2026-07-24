import { Injectable } from "@nestjs/common";
import { IImmunotherapyRepository } from "src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface";

@Injectable()
export class ListAllImmunotherapiesUseCase {
    constructor(private immunoRepository: IImmunotherapyRepository) {}

    async execute(orgId: string) {
        const immunotherapies = await this.immunoRepository.findAll(orgId);

        return immunotherapies;
    }
}