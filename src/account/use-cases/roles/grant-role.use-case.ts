import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { IRoleRepository } from '../../role.repository';
import { ROLE_MESSAGES } from '../../role.messages';
import { ITransactionContext } from 'src/database/transaction.interface';

interface GrantRoleParams {
  professionalId: string;
  role: Role;
  grantedById: string;
  bootstrapKey?: string;
}

@Injectable()
export class GrantRoleUseCase {
  constructor(
    private roleRepository: IRoleRepository,
    private configService: ConfigService,
  ) {}

  async execute(params: GrantRoleParams, tx?: ITransactionContext) {
    if (params.bootstrapKey !== undefined) {
      const secretKey = this.configService.get<string>(
        'SUPER_ADMIN_REGISTRATION_KEY',
      );

      if (params.bootstrapKey !== secretKey) {
        throw new UnauthorizedException(ROLE_MESSAGES.invalidBootstrapKey);
      }
    }

    const existing =
      await this.roleRepository.findActiveByProfessionalAndRole(
        params.professionalId,
        params.role,
        tx,
      );

    if (existing) {
      throw new ConflictException(ROLE_MESSAGES.alreadyGranted(params.role));
    }

    return this.roleRepository.grant(
      {
        professionalId: params.professionalId,
        role: params.role,
        grantedById: params.grantedById,
      },
      tx,
    );
  }
}
