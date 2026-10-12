import { Injectable, NotFoundException } from '@nestjs/common';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { PrismaService } from 'src/infra/database/prisma.service';
import { UserAccessService } from 'src/account/user-access.service';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { PROFESSIONAL_MESSAGES } from '../professional.messages';

@Injectable()
export class UpdateMemberAccessUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: IAuditLogService,
    private readonly userAccess: UserAccessService,
  ) {}

  async execute(
    professionalId: string,
    isActive: boolean,
    currentUser: AuthenticatedUserPayload,
  ): Promise<{ professionalId: string; userId: string; isActive: boolean }> {
    const professional = await this.prisma.professional.findFirst({
      where: { id: professionalId, organizationId: currentUser.organizationId },
      select: { id: true, userId: true },
    });

    if (!professional) {
      throw new NotFoundException(
        PROFESSIONAL_MESSAGES.notFound(professionalId),
      );
    }

    await this.userAccess.setActive(
      professional.userId,
      isActive,
      currentUser,
      async (tx, before, after) => {
        await this.auditLog.record(
          {
            userId: currentUser.id,
            organizationId: currentUser.organizationId,
            entityType: AUDIT_ENTITY_TYPES.PROFESSIONAL,
            entityId: professional.id,
            action: isActive
              ? AUDIT_ACTIONS.PROFESSIONAL_REACTIVATED
              : AUDIT_ACTIONS.PROFESSIONAL_DEACTIVATED,
            oldValues: { isActive: before.isActive },
            newValues: { isActive: after.isActive },
            changedFields: ['isActive'],
          },
          tx,
        );
      },
    );

    return {
      professionalId: professional.id,
      userId: professional.userId,
      isActive,
    };
  }
}
