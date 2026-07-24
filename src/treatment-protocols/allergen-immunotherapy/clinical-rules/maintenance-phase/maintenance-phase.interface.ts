import { Dose } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/entities/dose.entity';
import { Immunotherapy } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/entities/immunotherapy.entity';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';

export abstract class IMaintenancePhase {
  abstract registerScheduledMaintenanceDose(
    registeredDose: Dose,
    currentUser: AuthenticatedUserPayload,
    immunotherapy: Immunotherapy,
  ): Promise<Dose>;
}
