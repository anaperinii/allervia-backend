import { Injectable, NotFoundException } from '@nestjs/common';
import { ProfessionalRepository } from '../professional.repository';
import { UpdateProfessionalDto } from '../dtos/update-professional.dto';
import { PROFESSIONAL_MESSAGES } from '../professional.messages';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class UpdateProfessionalUseCase {
  constructor(private professionalRepository: ProfessionalRepository) {}

  async execute(
    id: string,
    dto: UpdateProfessionalDto,
    tx?: ITransactionContext,
  ) {
    const professional = await this.professionalRepository.findById(id, tx);

    if (!professional) {
      throw new NotFoundException(PROFESSIONAL_MESSAGES.notFound(id));
    }

    return this.professionalRepository.update({ id, ...dto }, tx);
  }
}
