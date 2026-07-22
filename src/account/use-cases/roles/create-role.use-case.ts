import { Injectable, UnauthorizedException } from '@nestjs/common';
import { IRoleRepository } from '../../role.repository';
import { CreateRoleDto } from '../../dtos/roles/create-role.dto';
import { RoleResponseDto } from '../../dtos/roles/role-response.dto';
import { Role } from '../../domain/entities/role.entity';
import { ITransactionContext } from 'src/database/transaction.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CreateRoleUseCase {
  constructor(
    private roleRepository: IRoleRepository,
    private configService: ConfigService
  ) {}

  async execute(
    dto: CreateRoleDto, 
    tx?: ITransactionContext,
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

    const savedRole = await this.roleRepository.create(role, tx);
    return savedRole;
  }
}

