import { Injectable, NotFoundException } from '@nestjs/common';
import { IRoleRepository } from 'src/security/permissions/role.repository';
import { ROLE_MESSAGES } from 'src/security/permissions/role.messages';

@Injectable()
export class FindRoleByIdUseCase {
  constructor(private roleRepository: IRoleRepository) {}

  async execute(id: string) {
    const role = await this.roleRepository.findById(id);

    if (!role) {
      throw new NotFoundException(ROLE_MESSAGES.notFound(id));
    }

    return role;
  }
}
