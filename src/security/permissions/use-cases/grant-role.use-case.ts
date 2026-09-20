import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
}

@Injectable()
export class GrantRoleUseCase {
  constructor(
    private roleRepository: IRoleRepository,
    private professionalRepository: ProfessionalRepository,
    private prisma: PrismaService,
    private auditLog: IAuditLogService,
  ) {}

  async execute(params: GrantRoleParams, tx?: Prisma.TransactionClient) {
    if (tx) {
      return this.grantWithAudit(params, tx);
    }

    return this.prisma.$transaction((trx) => this.grantWithAudit(params, trx));
  }

  private async grantWithAudit(
    params: GrantRoleParams,
    tx: Prisma.TransactionClient,
  ) {
    const actor = await this.resolveActor(params, tx);

    const existing = await this.roleRepository.findActiveByProfessionalAndRole(
      params.professionalId,
      params.role,
      tx,
    );

    if (existing) {
      throw new ConflictException(ROLE_MESSAGES.alreadyGranted(params.role));
    }

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

  /**
   * O papel só pode ser concedido dentro da organização do ator. Conhecer o
   * identificador de um profissional de outra clínica não autoriza nada.
   */
  private async resolveActor(
    params: GrantRoleParams,
    tx: Prisma.TransactionClient,
  ): Promise<{ userId: string; organizationId: string }> {
    const target = await this.professionalRepository.findById(
      params.professionalId,
      tx,
    );

    if (!target) {
      throw new NotFoundException(
        PROFESSIONAL_MESSAGES.notFound(params.professionalId),
      );
    }

    if (params.actorUserId && params.organizationId) {
      if (target.organizationId !== params.organizationId) {
        throw new NotFoundException(
          PROFESSIONAL_MESSAGES.notFound(params.professionalId),
        );
      }

      const granter = await this.professionalRepository.findById(
        params.grantedById,
        tx,
      );

      if (!granter || granter.organizationId !== params.organizationId) {
        throw new ForbiddenException(ROLE_MESSAGES.grantOutsideOrganization);
      }

      return {
        userId: params.actorUserId,
        organizationId: params.organizationId,
      };
    }

    // Concessão interna (registro por convite): a autoria acompanha o vínculo.
    return {
      userId: target.userId,
      organizationId: target.organizationId,
    };
  }
}
