import { Injectable } from '@nestjs/common';
import { IRoleRepository } from '../../domain/repositories/role.repository.interface';
import { UpdateRoleDto } from '../dtos/update-role.dto';
import { RoleResponseDto } from '../dtos/role-response.dto';
import { RoleNotFoundException } from '../../domain/exceptions/role-not-found.exception';
import { Prisma } from '@prisma/client';

@Injectable()
export class UpdateRoleUseCase {
  constructor(
    private roleRepository: IRoleRepository
  ) {}

  async execute(
    id: string, 
    dto: UpdateRoleDto, 
    organizationId: string,
    tx?: Prisma.TransactionClient
  ): Promise<RoleResponseDto> {

    const role = await this.roleRepository.findById(id, organizationId, tx);

    if (!role) {
      throw new RoleNotFoundException(id);
    }

    role.update(dto.description);
    const updatedRole = await this.roleRepository.update(role);
    return updatedRole;
  }
}

