import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '@prisma/client';
import { IRoleRepository } from 'src/security/permissions/role.repository';
import { ROLE_MESSAGES } from 'src/security/permissions/role.messages';
import { ProfessionalRepository } from 'src/professionals/professional.repository';
import { PROFESSIONAL_MESSAGES } from 'src/professionals/professional.messages';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';

interface GrantRoleParams {
  professionalId: string;
  role: Role;
  grantedById: string;
  actorUserId?: string;
  organizationId?: string;
  bootstrapKey?: string;
}

@Injectable()
export class GrantRoleUseCase {
  constructor(
    private roleRepository: IRoleRepository,
    private professionalRepository: ProfessionalRepository,
    private configService: ConfigService,
    private prisma: PrismaService,
    private auditLog: IAuditLogService,
  ) {}

  async execute(params: GrantRoleParams, tx?: Prisma.TransactionClient) {
    if (params.bootstrapKey !== undefined) {
      const secretKey = this.configService.get<string>(
        'SUPER_ADMIN_REGISTRATION_KEY',
      );

      if (params.bootstrapKey !== secretKey) {
        throw new UnauthorizedException(ROLE_MESSAGES.invalidBootstrapKey);
      }
    }

    if (tx) {
      return this.grantWithAudit(params, tx);
    }

    return this.prisma.$transaction((trx) => this.grantWithAudit(params, trx));
  }

  private async grantWithAudit(
    params: GrantRoleParams,
    tx: Prisma.TransactionClient,
  ) {
    const existing = await this.roleRepository.findActiveByProfessionalAndRole(
      params.professionalId,
      params.role,
      tx,
    );

    if (existing) {
      throw new ConflictException(ROLE_MESSAGES.alreadyGranted(params.role));
    }

    const actor = await this.resolveActor(params, tx);

    const granted = await this.roleRepository.grant(
      {
        professionalId: params.professionalId,
        role: params.role,
        grantedById: params.grantedById,
      },
      tx,
    );

    await this.auditLog.record(
      {
        userId: actor.userId,
        organizationId: actor.organizationId,
        entityType: AUDIT_ENTITY_TYPES.PROFESSIONAL,
        entityId: params.professionalId,
        action: AUDIT_ACTIONS.ROLE_GRANTED,
        newValues: {
          role: granted.role,
          professionalRoleId: granted.id,
          grantedById: granted.grantedById,
        },
        changedFields: ['role'],
      },
      tx,
    );

    return granted;
  }

  private async resolveActor(
    params: GrantRoleParams,
    tx: Prisma.TransactionClient,
  ): Promise<{ userId: string; organizationId: string }> {
    if (params.actorUserId && params.organizationId) {
      return {
        userId: params.actorUserId,
        organizationId: params.organizationId,
      };
    }

    const professional = await this.professionalRepository.findById(
      params.professionalId,
      tx,
    );

    if (!professional) {
      throw new NotFoundException(
        PROFESSIONAL_MESSAGES.notFound(params.professionalId),
      );
    }

    return {
      userId: professional.userId,
      organizationId: professional.organizationId,
    };
  }
}
