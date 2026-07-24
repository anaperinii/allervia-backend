import { Injectable } from '@nestjs/common';
import { IDoseRepository } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface';
import { Dose } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/entities/dose.entity';

@Injectable()
export class ListDosesByTherapyUseCase {
  constructor(private readonly doseRepository: IDoseRepository) {}

  async execute(immunotherapyId: string, orgId: string): Promise<Dose[]> {
    const doses = await this.doseRepository.findByImmunotherapy(
      immunotherapyId,
      orgId,
    );
    return doses;
  }
}
