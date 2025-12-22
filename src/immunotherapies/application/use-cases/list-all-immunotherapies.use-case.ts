import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { IImmunotherapyRepository } from "src/immunotherapies/domain/contracts/immunotherapy.repository.interface";

@Injectable()
export class ListAllImmunotherapiesUseCase {
    constructor(private immunoRepository: IImmunotherapyRepository) {}

    async execute(orgId: string, tx?: Prisma.TransactionClient) {
        const immunotherapies = await this.immunoRepository.findAll(orgId);

        return immunotherapies;
    }
}