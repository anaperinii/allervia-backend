import { Injectable } from '@nestjs/common';
import { IRoleRepository } from '../../domain/repositories/role.repository.interface';
import { RoleResponseDto } from '../dtos/role-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ListRolesUseCase {
  constructor(
    private roleRepository: IRoleRepository
  ) {}

  async execute(
    organizationId: string,
    tx?: Prisma.TransactionClient
  ): Promise<RoleResponseDto[]> {
    const roles = await this.roleRepository.findAllActive(organizationId, tx);
    return roles;
  }
}

