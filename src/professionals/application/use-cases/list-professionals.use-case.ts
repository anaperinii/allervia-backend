import { Injectable } from '@nestjs/common';
import { IProfessionalRepository } from '../../domain/professional.repository.interface';
import { ProfessionalResponseDto } from '../dtos/professional-response.dto';

@Injectable()
export class ListProfessionalsUseCase {
  constructor(
    private readonly professionalRepository: IProfessionalRepository
  ) {}

  async execute(): Promise<ProfessionalResponseDto[]> {
    const professionals = await this.professionalRepository.findAllProfessionals();
    if (!professionals) {
      return [];
    }
    return professionals;
  }
}

