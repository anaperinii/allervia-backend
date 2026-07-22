import { Injectable } from '@nestjs/common';
import { IRoleRepository } from '../../role.repository';
import { RoleType } from '@prisma/client';
import { RoleInUseException } from '../../exceptions/roles/role-in-use.exception';
import { FindRoleByNameUseCase } from './find-role-by-name.use-case';

@Injectable()
export class DeleteRoleUseCase {
  constructor(
    private roleRepository: IRoleRepository,
    private findRoleByName: FindRoleByNameUseCase
  ) {}

  async execute(
    roleName: RoleType, 
    organizationId: string
  ): Promise<void> {

    const role = await this.findRoleByName.execute(roleName, organizationId);

    if (role.isActive) {
      throw new RoleInUseException(roleName);
    }

    const hasActiveUsers = await this.roleRepository.hasActiveUserRoles(roleName, organizationId);

    if (hasActiveUsers) {
      throw new RoleInUseException(roleName);
    }

    role.deactivate();
    
    await this.roleRepository.update(role);
  }
}

