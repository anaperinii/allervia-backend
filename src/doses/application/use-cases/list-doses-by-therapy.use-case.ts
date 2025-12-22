import { Injectable } from '@nestjs/common';
import { IDoseRepository } from '../../domain/contracts/dose.repository.interface';
import { Dose } from 'src/doses/domain/entities/dose.entity';

@Injectable()
export class ListDosesByTherapyUseCase {
  constructor(
    private readonly doseRepository: IDoseRepository
  ) {}

  async execute(immunotherapyId: string, orgId: string): Promise<Dose[]> {
    const doses = await this.doseRepository.findByImmunotherapy(immunotherapyId, orgId);
    return doses;
  }
}

