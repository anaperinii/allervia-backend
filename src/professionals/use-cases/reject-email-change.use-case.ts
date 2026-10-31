import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationKind, VerificationPurpose } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { enqueueEmailChangeOutbox } from 'src/notifications/notifications.service';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { PROFESSIONAL_MESSAGES } from '../professional.messages';
import { EmailChangeRequestDto } from '../dtos/request-email-change.dto';

@Injectable()
export class RejectEmailChangeUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: IAuditLogService,
  ) {}

  async execute(
    requestId: string,
    currentUser: AuthenticatedUserPayload,
  ): Promise<EmailChangeRequestDto> {
    const request = await this.prisma.verificationToken.findFirst({
      where: {
        id: requestId,
        purpose: VerificationPurpose.EMAIL_CHANGE,
        consumedAt: null,
        approvedAt: null,
        expiresAt: { gt: new Date() },
        user: {
          professional: { organizationId: currentUser.organizationId },
        },
      },
      select: {
        id: true,
        userId: true,
        newEmail: true,
        createdAt: true,
        expiresAt: true,
        user: {
          select: {
            email: true,
            professional: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    if (!request || !request.newEmail || !request.user.professional) {
      throw new NotFoundException(
        PROFESSIONAL_MESSAGES.emailChangeRequestNotFound,
      );
    }

    const professional = request.user.professional;
    const newEmail = request.newEmail;

    const rejected = await this.prisma.$transaction(async (tx) => {
      const decidedAt = new Date();
      const consumed = await tx.verificationToken.updateMany({
        where: { id: request.id, consumedAt: null, approvedAt: null },
        data: {
          consumedAt: decidedAt,
          rejectedAt: decidedAt,
          rejectedById: currentUser.id,
        },
      });

      if (consumed.count === 0) {
        return false;
      }

      await enqueueEmailChangeOutbox(
        tx,
        currentUser.organizationId,
        NotificationKind.EMAIL_CHANGE_REQUEST_DECIDED,
        {
          verificationTokenId: request.id,
          professionalId: professional.id,
          professionalName: professional.fullName,
          newEmail,
          decision: 'REJECTED',
          recipientProfessionalIds: [professional.id],
        },
      );

      await this.auditLog.record(
        {
          userId: currentUser.id,
          organizationId: currentUser.organizationId,
          entityType: AUDIT_ENTITY_TYPES.USER,
          entityId: request.userId,
          action: AUDIT_ACTIONS.EMAIL_CHANGE_REJECTED,
          oldValues: { email: request.user.email },
          newValues: { email: newEmail },
        },
        tx,
      );

      return true;
    });

    if (!rejected) {
      throw new NotFoundException(
        PROFESSIONAL_MESSAGES.emailChangeRequestNotFound,
      );
    }

    return {
      id: request.id,
      professionalId: professional.id,
      professionalName: professional.fullName,
      currentEmail: request.user.email,
      newEmail,
      status: 'REJECTED',
      expiresAt: request.expiresAt,
      requestedAt: request.createdAt,
    };
  }
}
