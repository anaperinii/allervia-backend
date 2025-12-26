import { Injectable } from "@nestjs/common";
import { ITransactionContext } from "src/database/transaction.interface";
import { IImmunotherapyRepository } from "src/immunotherapies/domain/contracts/immunotherapy.repository.interface";

@Injectable()
export class ListAllImmunotherapiesUseCase {
    constructor(private immunoRepository: IImmunotherapyRepository) {}

    async execute(orgId: string, tx?: ITransactionContext) {
        const immunotherapies = await this.immunoRepository.findAll(orgId);

        return immunotherapies;
    }
}