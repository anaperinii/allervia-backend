import { Injectable, NotFoundException } from '@nestjs/common';
import { ProfessionalRepository } from '../professional.repository';
import { UpdateProfessionalDto } from '../dtos/update-professional.dto';
import { PROFESSIONAL_MESSAGES } from '../professional.messages';

@Injectable()
export class UpdateProfessionalUseCase {
  constructor(private professionalRepository: ProfessionalRepository) {}

  async execute(
    id: string,
    dto: UpdateProfessionalDto
  ) {
    const professional = await this.professionalRepository.findById(id);

    if (!professional) {
      throw new NotFoundException(PROFESSIONAL_MESSAGES.notFound(id));
    }

    return this.professionalRepository.update({ id, ...dto });
  }
}
