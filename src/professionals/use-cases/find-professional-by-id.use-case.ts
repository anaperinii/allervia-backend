import { Injectable, NotFoundException } from '@nestjs/common';
import { ProfessionalRepository } from 'src/professionals/professional.repository';
import { PROFESSIONAL_MESSAGES } from 'src/professionals/professional.messages';

@Injectable()
export class FindProfessionalByIdUseCase {
  constructor(private professionalRepository: ProfessionalRepository) {}

  async execute(id: string) {
    const professional = await this.professionalRepository.findById(id);

    if (!professional) {
      throw new NotFoundException(PROFESSIONAL_MESSAGES.notFound(id));
    }

    return professional;
  }
}
