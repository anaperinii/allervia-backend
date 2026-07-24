import { Injectable } from '@nestjs/common';
import { IDoseRepository } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface';

@Injectable()
export class CountDosesByIntervalUseCase {
  constructor(private readonly doseRepository: IDoseRepository) {}

  async execute(
    intervalInDays: number,
    immunotherapyId: string,
    orgId: string,
  ) {
    const dosesCount = await this.doseRepository.countDosesByInterval(
      intervalInDays,
      immunotherapyId,
      orgId,
    );
    return dosesCount;
  }
}
