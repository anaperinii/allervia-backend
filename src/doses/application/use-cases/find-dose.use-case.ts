import { Injectable } from '@nestjs/common';
import { IDoseRepository } from '../../domain/contracts/dose.repository.interface';
import { DoseNotFoundException } from '../../domain/exceptions/dose-not-found.exception';
import { Dose } from 'src/doses/domain/entities/dose.entity';

@Injectable()
export class FindDoseUseCase {
  constructor(
    private readonly doseRepository: IDoseRepository
  ) {}

  async execute(id: string, orgId: string): Promise<Dose> {
    const dose = await this.doseRepository.findById(id, orgId);

    if (!dose) {
      throw new DoseNotFoundException(id);
    }

    return dose;
  }
}

