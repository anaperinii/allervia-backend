import { ITransactionContext } from "src/database/transaction.interface";
import { Dose } from "src/treatment-protocols/allergen-immunotherapy/dosing/domain/entities/dose.entity";
import { Immunotherapy } from "src/treatment-protocols/allergen-immunotherapy/therapies/domain/entities/immunotherapy.entity";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";

export abstract class IBuildUpPhase {
    abstract registerStartingBuildUpDose(registeredImmunotherapy: Immunotherapy, currentUser: AuthenticatedUserPayload, tx?: ITransactionContext): Promise<Dose>;
    abstract registerNextScheduledDose(registeredDose: Dose, currentUser: AuthenticatedUserPayload, immunotherapy: Immunotherapy): Promise<Dose>;
}