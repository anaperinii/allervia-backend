import { BadRequestException, Injectable } from '@nestjs/common';
import { IDoseRepository } from '../../domain/contracts/dose.repository.interface';
import { CreateDoseDto } from '../dtos/create-dose.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { Dose } from 'src/doses/domain/entities/dose.entity';

@Injectable()
export class CreateDoseUseCase {
  constructor(
    private readonly doseRepository: IDoseRepository
  ) {}

  async execute(
    therapyId: string,
    dto: CreateDoseDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<Dose> {

    const dose = Dose.createNew({
      concentration: dto.concentration,
      volume: dto.volume,
      scheduledAt: new Date(dto.scheduledAt),
      administeredAt: new Date(dto.administeredAt),
      nextIntervalInDays: dto.nextIntervalInDays,
      sideEffect: dto.sideEffect,
      medicationRequired: dto.medicationRequired,
      notes: dto.notes,
      immunotherapyId: therapyId,
      administeredById: currentUser.id,
      createdById: currentUser.id,
      updatedById: currentUser.id
    });


    const savedDose = await this.doseRepository.create(dose);

    return savedDose;
  }
}

