import { Injectable, NotFoundException } from '@nestjs/common';
import { IDoseRepository } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface';
import { DOSE_MESSAGES } from 'src/treatment-protocols/allergen-immunotherapy/dosing/dose.messages';
import { Dose } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/entities/dose.entity';

@Injectable()
export class FindDoseUseCase {
  constructor(
    private readonly doseRepository: IDoseRepository
  ) {}

  async execute(id: string, orgId: string): Promise<Dose> {
    const dose = await this.doseRepository.findById(id, orgId);

    if (!dose) {
      throw new NotFoundException(DOSE_MESSAGES.notFound(id));
    }

    return dose;
  }
}


