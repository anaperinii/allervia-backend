import { Injectable } from '@nestjs/common';
import { IRoleRepository } from '../../domain/contracts/role.repository.interface';
import { RoleResponseDto } from '../dtos/role-response.dto';
import { RoleNotFoundException } from '../../domain/exceptions/role-not-found.exception';
import { Prisma } from '@prisma/client';

@Injectable()
export class FindRoleByIdUseCase {
  constructor(
    private roleRepository: IRoleRepository
  ) {}

  async execute(
    id: string, 
    organizationId: string
  ): Promise<RoleResponseDto> {
    
    const role = await this.roleRepository.findById(id, organizationId);

    if (!role) {
      throw new RoleNotFoundException(id);
    }

    return role;
  }
}

