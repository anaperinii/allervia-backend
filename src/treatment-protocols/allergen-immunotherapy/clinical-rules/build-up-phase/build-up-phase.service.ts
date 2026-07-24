import { Injectable } from "@nestjs/common";
import { IBuildUpPhase } from "./build-up-phase.interface";
import { Dose } from "src/treatment-protocols/allergen-immunotherapy/dosing/domain/entities/dose.entity";
import { Immunotherapy } from "src/treatment-protocols/allergen-immunotherapy/therapies/domain/entities/immunotherapy.entity";
import { RegisterStartingDoseUseCase } from "./register-starting-dose.use-case";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { RegisterNextScheduledBuildUpUseCase } from "./register-scheduled-build-up.use-case";
import { Prisma } from '@prisma/client';

@Injectable()
export class BuildUpPhaseService extends IBuildUpPhase {

    constructor(
        private readonly registerStartingDoseUseCase: RegisterStartingDoseUseCase,
        private readonly registerNextScheduledUseCase: RegisterNextScheduledBuildUpUseCase
    ) { super() }

    async registerStartingBuildUpDose(registeredImmunotherapy: Immunotherapy, currentUser: AuthenticatedUserPayload, tx?: Prisma.TransactionClient): Promise<Dose> {
        return await this.registerStartingDoseUseCase.execute(registeredImmunotherapy, currentUser, tx);
    }

    async registerNextScheduledDose(registeredDose: Dose, currentUser: AuthenticatedUserPayload, immunotherapy: Immunotherapy): Promise<Dose> {
        return await this.registerNextScheduledUseCase.execute(registeredDose, currentUser, immunotherapy);
    }
    
}