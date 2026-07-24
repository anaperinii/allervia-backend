import { Injectable, NotFoundException } from '@nestjs/common';
import { ProfessionalRepository } from '../professional.repository';
import { PROFESSIONAL_MESSAGES } from '../professional.messages';

@Injectable()
export class FindProfessionalByUserUseCase {
  constructor(private professionalRepository: ProfessionalRepository) {}

  async execute(userId: string) {
    const professional = await this.professionalRepository.findByUserId(userId);

    if (!professional) {
      throw new NotFoundException(
        PROFESSIONAL_MESSAGES.notFoundForUser(userId),
      );
    }

    return professional;
  }
}
