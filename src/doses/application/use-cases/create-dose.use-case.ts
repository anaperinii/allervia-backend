import { Injectable } from '@nestjs/common';
import { IDoseRepository } from '../../domain/contracts/dose.repository.interface';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { Dose } from 'src/doses/domain/entities/dose.entity';
import { CreateScheduledDoseData } from 'src/doses/domain/contracts/doses.interface';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class CreateDoseUseCase {
  constructor(
    private readonly doseRepository: IDoseRepository
  ) {}

  async execute(
    data: CreateScheduledDoseData,
    currentUser: AuthenticatedUserPayload,
    tx?: ITransactionContext,
  ): Promise<Dose> {

    const dose = Dose.createNew({
      concentration: data.concentration,
      volume: data.volume,
      scheduledAt: new Date(data.scheduledAt),
      nextIntervalInDays: data.nextIntervalInDays,
      immunotherapyId: data.immunotherapyId,
      createdById: currentUser.id,
      updatedById: currentUser.id
    });

    const savedDose = await this.doseRepository.create(dose, tx);

    return savedDose;
  }
}

