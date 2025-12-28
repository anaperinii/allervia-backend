import { Injectable } from "@nestjs/common";
import { IMaintenancePhase } from "./maintenance-phase.interface";
import { Dose } from "src/treatment-protocols/allergen-immunotherapy/dosing/domain/entities/dose.entity";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { RegisterNextScheduledMaintenanceUseCase } from "./register-scheduled-maintenance.use-case";
import { Immunotherapy } from "src/treatment-protocols/allergen-immunotherapy/therapies/domain/entities/immunotherapy.entity";

@Injectable()
export class MaintenancePhaseService extends IMaintenancePhase {
    constructor ( private readonly registerScheduledMaintenanceUseCase: RegisterNextScheduledMaintenanceUseCase) { super() }
    
    async registerScheduledMaintenanceDose(registeredDose: Dose, currentUser: AuthenticatedUserPayload, immunotherapy: Immunotherapy): Promise<Dose> {
        return this.registerScheduledMaintenanceUseCase.execute(registeredDose, currentUser, immunotherapy);
    }
    
}