import { Dose } from "src/doses/domain/entities/dose.entity";
import { Immunotherapy } from "src/immunotherapies/domain/entities/immunotherapy.entity";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";

export abstract class IMaintenancePhase {
    abstract registerScheduledMaintenanceDose(registeredDose: Dose, currentUser: AuthenticatedUserPayload, immunotherapy: Immunotherapy): Promise<Dose>;
}