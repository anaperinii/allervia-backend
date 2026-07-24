import { Injectable, NotFoundException } from '@nestjs/common';
import { IRoleRepository } from '../role.repository';
import { ROLE_MESSAGES } from '../role.messages';

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
