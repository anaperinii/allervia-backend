import { Injectable } from "@nestjs/common";
import { CreateDoseUseCase } from "src/doses/application/use-cases/create-dose.use-case";
import { CreateScheduledDoseData } from "src/doses/domain/contracts/doses.interface";
import { Dose } from "src/doses/domain/entities/dose.entity";
import { Immunotherapy } from "src/immunotherapies/domain/entities/immunotherapy.entity";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { BUILD_UP_INTERVAL, STARTING_DOSE_CONCENTRATION, STARTING_DOSE_VOLUME } from "./build-up-phase.variables";
import { ITransactionContext } from "src/database/transaction.interface";

@Injectable()
export class RegisterStartingDoseUseCase  {

    constructor(
        private readonly createDoseUseCase: CreateDoseUseCase
    ) {}

    async execute(registeredImmunotherapy: Immunotherapy, currentUser: AuthenticatedUserPayload, tx?: ITransactionContext): Promise<Dose> {
        const dto = {
            concentration: STARTING_DOSE_CONCENTRATION,
            volume: STARTING_DOSE_VOLUME,
            scheduledAt: registeredImmunotherapy.inductionStartDate,
            nextIntervalInDays: BUILD_UP_INTERVAL,
            immunotherapyId: registeredImmunotherapy.id
        } as CreateScheduledDoseData;

        return await this.createDoseUseCase.execute(dto, currentUser, tx);
    }
}