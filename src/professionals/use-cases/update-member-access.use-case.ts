import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthSessionRevokeReason } from '@prisma/client';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { PrismaService } from 'src/infra/database/prisma.service';
import { SessionService } from 'src/security/session/session.service';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { PROFESSIONAL_MESSAGES } from '../professional.messages';

@Injectable()
export class UpdateMemberAccessUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: IAuditLogService,
    private readonly sessionService: SessionService,
  ) {}

  async execute(
    professionalId: string,
    isActive: boolean,
    currentUser: AuthenticatedUserPayload,
  ): Promise<{ professionalId: string; userId: string; isActive: boolean }> {
    const professional = await this.prisma.professional.findFirst({
      where: { id: professionalId, organizationId: currentUser.organizationId },
      select: { id: true, userId: true, user: { select: { isActive: true } } },
    });

    if (!professional) {
      throw new NotFoundException(
        PROFESSIONAL_MESSAGES.notFound(professionalId),
      );
    }

    if (professional.id === currentUser.professionalId && !isActive) {
      throw new ForbiddenException(PROFESSIONAL_MESSAGES.cannotDisableSelf);
    }

    if (professional.user.isActive === isActive) {
      return {
        professionalId: professional.id,
        userId: professional.userId,
        isActive,
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: professional.userId },
        data: { isActive, tokenVersion: { increment: 1 } },
      });

      await this.auditLog.record(
        {
          userId: currentUser.id,
          organizationId: currentUser.organizationId,
          entityType: AUDIT_ENTITY_TYPES.PROFESSIONAL,
          entityId: professional.id,
          action: isActive
            ? AUDIT_ACTIONS.PROFESSIONAL_REACTIVATED
            : AUDIT_ACTIONS.PROFESSIONAL_DEACTIVATED,
          oldValues: { isActive: professional.user.isActive },
          newValues: { isActive },
          changedFields: ['isActive'],
        },
        tx,
      );
    });

    if (!isActive) {
      await this.sessionService.revokeAllForUser(
        professional.userId,
        AuthSessionRevokeReason.ACCOUNT_DISABLED,
      );
    }

    return {
      professionalId: professional.id,
      userId: professional.userId,
      isActive,
    };
  }
}
