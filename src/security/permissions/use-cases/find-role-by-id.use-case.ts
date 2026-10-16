import { Injectable, NotFoundException } from '@nestjs/common';
import { IRoleRepository } from 'src/security/permissions/role.repository';
import { ROLE_MESSAGES } from 'src/security/permissions/role.messages';
import { ProfessionalRepository } from 'src/professionals/professional.repository';

@Injectable()
export class FindRoleByIdUseCase {
  constructor(
    private roleRepository: IRoleRepository,
    private professionalRepository: ProfessionalRepository,
  ) {}

  async execute(id: string, organizationId: string) {
    const role = await this.roleRepository.findById(id);

    if (!role) {
      throw new NotFoundException(ROLE_MESSAGES.notFound(id));
    }

    const holder = await this.professionalRepository.findById(
      role.professionalId,
    );

    if (!holder || holder.organizationId !== organizationId) {
      throw new NotFoundException(ROLE_MESSAGES.notFound(id));
    }

    return role;
  }
}
