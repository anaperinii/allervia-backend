import { Injectable } from '@nestjs/common';
import { Dose, DoseStatus } from '@prisma/client';
import { IDoseRepository } from '../../domain/contracts/dose.repository.interface';
import { DoseNotFoundException } from '../../domain/exceptions/dose-not-found.exception';
import { UpdateDoseStatusDto } from '../dtos/update-dose-status.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';

@Injectable()
export class UpdateDoseStatusUseCase {
  constructor(
    private readonly doseRepository: IDoseRepository
  ) {}

  async execute(
    id: string,
    dto: UpdateDoseStatusDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<Dose> {
    const dose = await this.doseRepository.findById(id, currentUser.activeOrgId);

    if (!dose) {
      throw new DoseNotFoundException(id);
    }

    dose.changeStatus(dto);
    dose.updatedById = currentUser.id;

    const savedDose = await this.doseRepository.update(dose.id, dose);

    return savedDose;
  }
}


