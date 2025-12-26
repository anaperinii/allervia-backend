import { Injectable } from "@nestjs/common";
import { IDoseRepository } from "src/doses/domain/contracts/dose.repository.interface";

@Injectable()
export class CountDosesByConcentration {
    constructor (
        private readonly doseRepository: IDoseRepository
    ) {}

    async execute(concentration: number, immunotherapyId: string, orgId: string) {
        const dosesCount = await this.doseRepository.countDosesByConcentration(concentration, immunotherapyId, orgId);
        return dosesCount;
    }
}