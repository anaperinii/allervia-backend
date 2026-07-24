import { Injectable } from '@nestjs/common';
import { IDoseRepository } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { Dose } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/entities/dose.entity';
import { CreateScheduledDoseData } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/doses.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class CreateDoseUseCase {
  constructor(private readonly doseRepository: IDoseRepository) {}

  async execute(
    data: CreateScheduledDoseData,
    currentUser: AuthenticatedUserPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<Dose> {
    const dose = Dose.createNew({
      concentration: data.concentration,
      volume: data.volume,
      scheduledAt: new Date(data.scheduledAt),
      nextIntervalInDays: data.nextIntervalInDays,
      immunotherapyId: data.immunotherapyId,
      createdById: currentUser.id,
      updatedById: currentUser.id,
    });

    const savedDose = await this.doseRepository.create(dose, tx);

    return savedDose;
  }
}
