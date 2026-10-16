import { Injectable, NotFoundException } from '@nestjs/common';
import { IRoleRepository } from 'src/security/permissions/role.repository';
import { ProfessionalRepository } from 'src/professionals/professional.repository';
import { PROFESSIONAL_MESSAGES } from 'src/professionals/professional.messages';

@Injectable()
export class ListProfessionalRolesUseCase {
  constructor(
    private roleRepository: IRoleRepository,
    private professionalRepository: ProfessionalRepository,
  ) {}

  async execute(professionalId: string, organizationId: string) {
    const professional =
      await this.professionalRepository.findById(professionalId);

    if (!professional || professional.organizationId !== organizationId) {
      throw new NotFoundException(
        PROFESSIONAL_MESSAGES.notFound(professionalId),
      );
    }

    return this.roleRepository.findActiveByProfessional(professionalId);
  }
}
