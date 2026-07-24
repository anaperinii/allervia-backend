import { Injectable } from "@nestjs/common";
import { CreateDoseUseCase } from "src/treatment-protocols/allergen-immunotherapy/dosing/use-cases/create-dose.use-case";
import { CreateScheduledDoseData } from "src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/doses.interface";
import { Dose } from "src/treatment-protocols/allergen-immunotherapy/dosing/domain/entities/dose.entity";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { BUILD_UP_INTERVAL, NextDoseCalculation, STARTING_DOSE_VOLUME } from "./build-up-phase.variables";
import { addDate } from "src/utils/date.utils";
import { CountDosesByConcentration } from "src/treatment-protocols/allergen-immunotherapy/dosing/use-cases/count-doses-by-concentration.use-case";
import { Immunotherapy } from "src/treatment-protocols/allergen-immunotherapy/therapies/domain/entities/immunotherapy.entity";

@Injectable()
export class RegisterNextScheduledBuildUpUseCase {

    constructor(
        private readonly createDoseUseCase: CreateDoseUseCase,
        private readonly countDoseByConcentration: CountDosesByConcentration
    ) {}

    async execute(registeredDose: Dose, currentUser: AuthenticatedUserPayload, immunotherapy: Immunotherapy): Promise<Dose> {
        // Validar que a dose foi administrada (pode ser ON_SCHEDULE ou OFF_SCHEDULE)
        if (!registeredDose.administeredAt || 
            (registeredDose.status !== 'ADMINISTERED_ON_SCHEDULE' && registeredDose.status !== 'ADMINISTERED_OFF_SCHEDULE')) {
            throw new Error('Apenas doses administradas podem gerar próxima dose agendada');
        }

        if (registeredDose.concentration === immunotherapy.targetConcentration 
            && registeredDose.volume === immunotherapy.targetVolume - 0.1) {
                const dto = {
                    concentration: immunotherapy.targetConcentration,
                    volume: immunotherapy.targetVolume,
                    scheduledAt: addDate(registeredDose.administeredAt, BUILD_UP_INTERVAL),
                    nextIntervalInDays: BUILD_UP_INTERVAL,
                    immunotherapyId: immunotherapy.id
                } as CreateScheduledDoseData;
                
                return await this.createDoseUseCase.execute(dto, currentUser);
        }

        const { nextConcentration, nextVolume } = await this.calculateNextDose(registeredDose, currentUser, immunotherapy);

        const dto = {
            concentration: nextConcentration,
            volume: nextVolume,
            scheduledAt: addDate(registeredDose.administeredAt, BUILD_UP_INTERVAL),
            nextIntervalInDays: BUILD_UP_INTERVAL,
            immunotherapyId: immunotherapy.id
        } as CreateScheduledDoseData;
                
        return await this.createDoseUseCase.execute(dto, currentUser);
    }

    private async calculateNextDose(registeredDose: Dose, currentUser: AuthenticatedUserPayload, immunotherapy: Immunotherapy): Promise<NextDoseCalculation> {

        const currentConcentration = registeredDose.concentration;
        let nextConcentration: number;
        let nextVolume: number;

        const dosesInCurrentConcentration = await this.countDoseByConcentration.execute(
            currentConcentration, 
            registeredDose.immunotherapyId, 
            currentUser.activeOrgId
        );

        if (dosesInCurrentConcentration < 4) {
            nextConcentration = currentConcentration;
            // Se está na targetConcentration e o próximo volume (dobrado) seria maior que targetVolume - 0.1, 
            // então vai direto para targetVolume (0.5) em vez de dobrar para 0.8
            // Progressão na targetConcentration: 0.1 → 0.2 → 0.4 → 0.5 (não 0.8)
            if (currentConcentration === immunotherapy.targetConcentration 
                && registeredDose.volume * 2 > immunotherapy.targetVolume - 0.1) {
                nextVolume = immunotherapy.targetVolume;
            } else {
                nextVolume = registeredDose.volume * 2;
            }
            return { nextConcentration, nextVolume }
        }

        nextConcentration = currentConcentration / 10;
        nextVolume = STARTING_DOSE_VOLUME;
        return {nextConcentration, nextVolume}
    }
}