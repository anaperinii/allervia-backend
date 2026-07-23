import { Injectable } from '@nestjs/common';
import { ProfessionalRepository } from '../professional.repository';
import { CreateProfessionalData } from '../professional.interface';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class CreateProfessionalUseCase {
  constructor(private professionalRepository: ProfessionalRepository) {}

  async execute(data: CreateProfessionalData, tx?: ITransactionContext) {
    return this.professionalRepository.create(data, tx);
  }
}
