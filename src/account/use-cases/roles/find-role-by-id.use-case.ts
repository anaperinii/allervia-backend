import { Injectable, NotFoundException } from '@nestjs/common';
import { IRoleRepository } from '../../role.repository';
import { ROLE_MESSAGES } from '../../role.messages';

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
