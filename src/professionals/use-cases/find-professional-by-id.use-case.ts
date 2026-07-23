import { Injectable, NotFoundException } from '@nestjs/common';
import { ProfessionalRepository } from '../professional.repository';
import { PROFESSIONAL_MESSAGES } from '../professional.messages';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class FindProfessionalByIdUseCase {
  constructor(private professionalRepository: ProfessionalRepository) {}

  async execute(id: string, tx?: ITransactionContext) {
    const professional = await this.professionalRepository.findById(id, tx);

    if (!professional) {
      throw new NotFoundException(PROFESSIONAL_MESSAGES.notFound(id));
    }

    return professional;
  }
}
