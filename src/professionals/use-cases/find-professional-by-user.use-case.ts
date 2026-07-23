import { Injectable, NotFoundException } from '@nestjs/common';
import { ProfessionalRepository } from '../professional.repository';
import { PROFESSIONAL_MESSAGES } from '../professional.messages';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class FindProfessionalByUserUseCase {
  constructor(private professionalRepository: ProfessionalRepository) {}

  async execute(userId: string, tx?: ITransactionContext) {
    const professional = await this.professionalRepository.findByUserId(
      userId,
      tx,
    );

    if (!professional) {
      throw new NotFoundException(
        PROFESSIONAL_MESSAGES.notFoundForUser(userId),
      );
    }

    return professional;
  }
}
