import { Injectable } from '@nestjs/common';
import { IProfessionalRepository } from '../../domain/professional.repository.interface';
import { ProfessionalResponseDto } from '../dtos/professional-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';

@Injectable()
export class ListProfessionalsByOrganizationUseCase {
  constructor(
    private readonly professionalRepository: IProfessionalRepository
  ) {}

  async execute(currentUser: AuthenticatedUserPayload): Promise<ProfessionalResponseDto[]> {
    const professionals = await this.professionalRepository.findAllProfessionalByOrgId(
      currentUser.activeOrgId,
    );
    return professionals;
  }
}

