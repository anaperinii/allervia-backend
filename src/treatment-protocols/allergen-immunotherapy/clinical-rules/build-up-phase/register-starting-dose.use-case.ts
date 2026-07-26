import { Injectable } from '@nestjs/common';
import { CreateDoseUseCase } from 'src/treatment-protocols/allergen-immunotherapy/dosing/use-cases/create-dose.use-case';
import { CreateScheduledDoseData } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/doses.interface';
import { Dose } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/entities/dose.entity';
import { Immunotherapy } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/entities/immunotherapy.entity';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import {
  BUILD_UP_INTERVAL,
  STARTING_DOSE_CONCENTRATION,
  STARTING_DOSE_VOLUME,
} from './build-up-phase.variables';
import { Prisma } from '@prisma/client';

@Injectable()
export class RegisterStartingDoseUseCase {
  constructor(private readonly createDoseUseCase: CreateDoseUseCase) {}

  async execute(
    registeredImmunotherapy: Immunotherapy,
    currentUser: AuthenticatedUserPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<Dose> {
    const dto = {
      concentration: STARTING_DOSE_CONCENTRATION,
      volume: STARTING_DOSE_VOLUME,
      scheduledAt: registeredImmunotherapy.inductionStartDate,
      nextIntervalInDays: BUILD_UP_INTERVAL,
      immunotherapyId: registeredImmunotherapy.id,
    } as CreateScheduledDoseData;

    return await this.createDoseUseCase.execute(dto, currentUser, tx);
  }
}
