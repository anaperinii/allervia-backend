import { Injectable, NotFoundException } from '@nestjs/common';
import { IRoleRepository } from 'src/security/permissions/role.repository';
import { ROLE_MESSAGES } from 'src/security/permissions/role.messages';

@Injectable()
export class RevokeRoleUseCase {
  constructor(private roleRepository: IRoleRepository) {}

  async execute(id: string, revokedById: string) {
    const role = await this.roleRepository.findById(id);

    if (!role || role.revokedAt) {
      throw new NotFoundException(ROLE_MESSAGES.notFound(id));
    }

    return this.roleRepository.revoke(id, revokedById);
  }
}
