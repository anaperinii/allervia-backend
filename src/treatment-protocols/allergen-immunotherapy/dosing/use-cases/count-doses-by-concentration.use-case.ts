import { Injectable } from "@nestjs/common";
import { IDoseRepository } from "src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface";

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