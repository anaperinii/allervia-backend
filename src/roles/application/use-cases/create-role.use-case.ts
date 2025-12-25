import { Injectable, UnauthorizedException } from '@nestjs/common';
import { IRoleRepository } from '../../domain/contracts/role.repository.interface';
import { CreateRoleDto } from '../dtos/create-role.dto';
import { RoleResponseDto } from '../dtos/role-response.dto';
import { Role } from '../../domain/entities/role.entity';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CreateRoleUseCase {
  constructor(
    private roleRepository: IRoleRepository,
    private configService: ConfigService
  ) {}

  async execute(
    dto: CreateRoleDto, 
    tx?: Prisma.TransactionClient,
  ): Promise<RoleResponseDto> {

    const secretKey = this.configService.get<string>('SUPER_ADMIN_REGISTRATION_KEY');

    if (dto.key !== secretKey) {
      throw new UnauthorizedException('Key inválida');
    }

    const role = Role.createNew({
      name: dto.name,
      description: dto.description || null,
      organizationId: dto.organizationId
    });

    const savedRole = await this.roleRepository.create(role);
    return savedRole;
  }
}

