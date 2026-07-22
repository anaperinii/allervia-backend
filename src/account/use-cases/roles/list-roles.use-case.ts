import { Injectable } from '@nestjs/common';
import { IRoleRepository } from '../../role.repository';
import { RoleResponseDto } from '../../dtos/roles/role-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ListRolesUseCase {
  constructor(
    private roleRepository: IRoleRepository
  ) {}

  async execute(
    organizationId: string
  ): Promise<RoleResponseDto[]> {
    const roles = await this.roleRepository.findAllActive(organizationId);
    return roles;
  }
}

