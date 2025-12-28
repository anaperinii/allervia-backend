import { Injectable } from '@nestjs/common';
import { IRoleRepository } from '../../domain/interfaces/role.repository.interface';
import { RoleResponseDto } from '../../dtos/roles/role-response.dto';
import { RoleNotFoundException } from '../../domain/exceptions/roles/role-not-found.exception';

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

