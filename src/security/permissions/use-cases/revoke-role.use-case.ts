import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IRoleRepository } from 'src/security/permissions/role.repository';
import { ROLE_MESSAGES } from 'src/security/permissions/role.messages';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { ProfessionalRepository } from 'src/professionals/professional.repository';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';

export interface RevokeRoleActor {
  userId: string;
  professionalId: string;
  organizationId: string;
}

@Injectable()
export class RevokeRoleUseCase {
  constructor(
    private roleRepository: IRoleRepository,
    private professionalRepository: ProfessionalRepository,
    private prisma: PrismaService,
    private auditLog: IAuditLogService,
  ) {}

  async execute(id: string, actor: RevokeRoleActor) {
    const role = await this.roleRepository.findById(id);

    if (!role || role.revokedAt) {
      throw new NotFoundException(ROLE_MESSAGES.notFound(id));
    }

    const holder = await this.professionalRepository.findById(
      role.professionalId,
    );

    if (!holder || holder.organizationId !== actor.organizationId) {
      throw new NotFoundException(ROLE_MESSAGES.notFound(id));
    }

    return this.prisma.$transaction(async (tx) => {
      if (role.role === 'ADMINISTRATOR') {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.organizationId}))`;
        const remainingAdministrators = await tx.professionalRole.count({
          where: {
            id: { not: role.id },
            role: 'ADMINISTRATOR',
            revokedAt: null,
            professional: {
              organizationId: actor.organizationId,
              user: { isActive: true, isArchived: false },
            },
          },
        });
        if (remainingAdministrators === 0) {
          throw new ConflictException('LAST_ADMINISTRATOR');
        }
      }
      const revoked = await this.roleRepository.revoke(
        id,
        actor.professionalId,
        tx,
      );

      await this.auditLog.record(
        {
          userId: actor.userId,
          organizationId: actor.organizationId,
          entityType: AUDIT_ENTITY_TYPES.PROFESSIONAL,
          entityId: role.professionalId,
          action: AUDIT_ACTIONS.ROLE_REVOKED,
          oldValues: { role: role.role, revokedAt: null },
          newValues: {
            role: revoked.role,
            professionalRoleId: revoked.id,
            revokedAt: revoked.revokedAt,
            revokedById: revoked.revokedById,
          },
          changedFields: ['revokedAt'],
        },
        tx,
      );

      return revoked;
    });
  }
}
