import { Prisma } from '@prisma/client';
import { Dose } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/entities/dose.entity';
import { Immunotherapy } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/entities/immunotherapy.entity';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

export abstract class IBuildUpPhase {
  abstract registerStartingBuildUpDose(
    registeredImmunotherapy: Immunotherapy,
    currentUser: AuthenticatedUserPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<Dose>;
  abstract registerNextScheduledDose(
    registeredDose: Dose,
    currentUser: AuthenticatedUserPayload,
    immunotherapy: Immunotherapy,
  ): Promise<Dose>;
}
