import { Injectable } from "@nestjs/common";
import { IBuildUpPhase } from "./build-up-phase.interface";
import { Dose } from "src/doses/domain/entities/dose.entity";
import { Immunotherapy } from "src/immunotherapies/domain/entities/immunotherapy.entity";
import { RegisterStartingDoseUseCase } from "./register-starting-dose.use-case";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { RegisterNextScheduledBuildUpUseCase } from "./register-scheduled-build-up.use-case";
import { ITransactionContext } from "src/database/transaction.interface";

@Injectable()
export class BuildUpPhaseService extends IBuildUpPhase {

    constructor(
        private readonly registerStartingDoseUseCase: RegisterStartingDoseUseCase,
        private readonly registerNextScheduledUseCase: RegisterNextScheduledBuildUpUseCase
    ) { super() }

    async registerStartingBuildUpDose(registeredImmunotherapy: Immunotherapy, currentUser: AuthenticatedUserPayload, tx?: ITransactionContext): Promise<Dose> {
        return await this.registerStartingDoseUseCase.execute(registeredImmunotherapy, currentUser, tx);
    }

    async registerNextScheduledDose(registeredDose: Dose, currentUser: AuthenticatedUserPayload, immunotherapy: Immunotherapy): Promise<Dose> {
        return await this.registerNextScheduledUseCase.execute(registeredDose, currentUser, immunotherapy);
    }
    
}