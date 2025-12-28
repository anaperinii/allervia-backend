import { Injectable } from '@nestjs/common';
import { IRoleRepository } from '../../domain/interfaces/role.repository.interface';
import { UpdateRoleDto } from '../../dtos/roles/update-role.dto';
import { RoleResponseDto } from '../../dtos/roles/role-response.dto';
import { RoleNotFoundException } from '../../domain/exceptions/roles/role-not-found.exception';
import { Prisma } from '@prisma/client';

@Injectable()
export class UpdateRoleUseCase {
  constructor(
    private roleRepository: IRoleRepository
  ) {}

  async execute(
    id: string, 
    dto: UpdateRoleDto, 
    organizationId: string
  ): Promise<RoleResponseDto> {

    const role = await this.roleRepository.findById(id, organizationId);

    if (!role) {
      throw new RoleNotFoundException(id);
    }

    role.update(dto.description);
    const updatedRole = await this.roleRepository.update(role);
    return updatedRole;
  }
}

