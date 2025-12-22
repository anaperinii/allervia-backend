import { BadRequestException, Injectable } from '@nestjs/common';
import { IDoseRepository } from '../../domain/contracts/dose.repository.interface';
import { DoseNotFoundException } from '../../domain/exceptions/dose-not-found.exception';
import { UpdateDoseDto } from '../dtos/update-dose.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { Dose } from '@prisma/client';

@Injectable()
export class UpdateDoseUseCase {
  constructor(
    private readonly doseRepository: IDoseRepository
  ) {}

  async execute(
    id: string,
    dto: UpdateDoseDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<Dose> {
    const dose = await this.doseRepository.findById(id, currentUser.activeOrgId);

    if (!dose) {
      throw new DoseNotFoundException(id);
    }
    
    const updatedDose = this.doseRepository.update(dose.id, dto);

    return updatedDose;
  }
}

