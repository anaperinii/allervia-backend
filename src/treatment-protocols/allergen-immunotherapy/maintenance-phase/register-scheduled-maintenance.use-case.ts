import { Injectable } from "@nestjs/common";
import { CountDosesByIntervalUseCase } from "src/doses/application/use-cases/count-doses-by-interval.use-case";
import { CreateDoseUseCase } from "src/doses/application/use-cases/create-dose.use-case";
import { CreateScheduledDoseData } from "src/doses/domain/contracts/doses.interface";
import { FindImmunotherapyUseCase } from "src/immunotherapies/application/use-cases/find-immunotherapy.use-case";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { addDate } from "src/shared/utils";
import { MAINTENANCE_INTERVALS } from "./maintenance-phase.variables";
import { Dose } from "src/doses/domain/entities/dose.entity";
import { Immunotherapy } from "src/immunotherapies/domain/entities/immunotherapy.entity";

@Injectable()
export class RegisterNextScheduledMaintenanceUseCase {
    constructor (
        private readonly findImmunotherapyById: FindImmunotherapyUseCase,
        private readonly createDoseUseCase: CreateDoseUseCase,
        private readonly countDosesByInterval: CountDosesByIntervalUseCase
    ) {}

    async execute(registeredDose: Dose, currentUser: AuthenticatedUserPayload, immunotherapy: Immunotherapy): Promise<Dose> {
        // Validar que a dose foi administrada (pode ser ON_SCHEDULE ou OFF_SCHEDULE)
        if (!registeredDose.administeredAt || 
            (registeredDose.status !== 'ADMINISTERED_ON_SCHEDULE' && registeredDose.status !== 'ADMINISTERED_OFF_SCHEDULE')) {
            throw new Error('Apenas doses administradas podem gerar próxima dose agendada');
        }

        const nextIntervalDays = await this.calculateNextMaintenanceInterval(registeredDose, currentUser);

        const dto = {
            concentration: immunotherapy.targetConcentration,
            volume: immunotherapy.targetVolume,
            scheduledAt: addDate(registeredDose.administeredAt, nextIntervalDays),
            nextIntervalInDays: nextIntervalDays,
            immunotherapyId: immunotherapy.id
        } as CreateScheduledDoseData;
                        
        return await this.createDoseUseCase.execute(dto, currentUser); 
    }

    private async calculateNextMaintenanceInterval(registeredDose: Dose, currentUser: AuthenticatedUserPayload): Promise<number> {

        if (registeredDose.nextIntervalInDays === 7) {
            return MAINTENANCE_INTERVALS[0].days;
        }

        const dosesInCurrentInterval = await this.countDosesByInterval.execute(
            registeredDose.nextIntervalInDays, 
            registeredDose.immunotherapyId, 
            currentUser.activeOrgId
        );

        if (dosesInCurrentInterval < 4) {
            return registeredDose.nextIntervalInDays;
        }

        const currentIndex = MAINTENANCE_INTERVALS.findIndex(interval => interval.days === registeredDose.nextIntervalInDays);

        if (currentIndex === MAINTENANCE_INTERVALS.length - 1) {
            return MAINTENANCE_INTERVALS[MAINTENANCE_INTERVALS.length - 1].days;
        }

        return MAINTENANCE_INTERVALS[currentIndex + 1].days;
    }
}