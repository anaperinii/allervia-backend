import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationKind, VerificationPurpose } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { enqueueEmailChangeOutbox } from 'src/notifications/notifications.service';
import { AUTH_ERROR_CODES, AUTH_MESSAGES } from 'src/security/auth.messages';
import { CodedHttpException } from 'src/infra/exceptions/coded.exception';
import { SecurityUtil } from 'src/utils/security.utils';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { PROFESSIONAL_MESSAGES } from '../professional.messages';
import {
  EmailChangeRequestDto,
  type EmailChangeChannel,
} from '../dtos/request-email-change.dto';
import { EmailChangeDispatcherService } from '../email-change-dispatcher.service';
import { EMAIL_CHANGE_CONFIRMATION_TTL_MINUTES } from './request-email-change.use-case';

@Injectable()
export class ApproveEmailChangeUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: EmailChangeDispatcherService,
    private readonly auditLog: IAuditLogService,
  ) {}

  async execute(
    requestId: string,
    channel: EmailChangeChannel,
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
        user: {
          select: {
            email: true,
            professional: {
              select: { id: true, fullName: true, phoneNumber: true },
            },
          },
        },
      },
    });

    if (!request || !request.newEmail || !request.user.professional) {
      throw new NotFoundException(
        PROFESSIONAL_MESSAGES.emailChangeRequestNotFound,
      );
    }

    const newEmail = request.newEmail;
    const professional = request.user.professional;

    const taken = await this.prisma.user.findFirst({
      where: { email: { equals: newEmail, mode: 'insensitive' } },
      select: { id: true },
    });

    if (taken && taken.id !== request.userId) {
      throw new CodedHttpException(
        HttpStatus.CONFLICT,
        AUTH_ERROR_CODES.emailAlreadyInUse,
        AUTH_MESSAGES.emailAlreadyInUse,
      );
    }

    const token = SecurityUtil.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + EMAIL_CHANGE_CONFIRMATION_TTL_MINUTES,
    );

    const approved = await this.prisma.verificationToken.updateMany({
      where: { id: request.id, consumedAt: null, approvedAt: null },
      data: {
        tokenHash: SecurityUtil.sha256(token),
        approvedAt: new Date(),
        approvedById: currentUser.id,
        expiresAt,
      },
    });

    if (approved.count === 0) {
      throw new NotFoundException(
        PROFESSIONAL_MESSAGES.emailChangeRequestNotFound,
      );
    }

    const whatsappUrl = await this.dispatcher.dispatch({
      channel,
      token,
      fullName: professional.fullName,
      currentEmail: request.user.email,
      newEmail,
      phoneNumber: professional.phoneNumber,
    });

    await this.prisma.$transaction(async (tx) => {
      await enqueueEmailChangeOutbox(
        tx,
        currentUser.organizationId,
        NotificationKind.EMAIL_CHANGE_REQUEST_DECIDED,
        {
          verificationTokenId: request.id,
          professionalId: professional.id,
          professionalName: professional.fullName,
          newEmail,
          decision: 'APPROVED',
          recipientProfessionalIds: [professional.id],
        },
      );

      await this.auditLog.record(
        {
          userId: currentUser.id,
          organizationId: currentUser.organizationId,
          entityType: AUDIT_ENTITY_TYPES.USER,
          entityId: request.userId,
          action: AUDIT_ACTIONS.EMAIL_CHANGE_APPROVED,
          oldValues: { email: request.user.email },
          newValues: { email: newEmail, channel },
          changedFields: ['email'],
        },
        tx,
      );
    });

    return {
      id: request.id,
      professionalId: professional.id,
      professionalName: professional.fullName,
      currentEmail: request.user.email,
      newEmail,
      status: 'DISPATCHED',
      expiresAt,
      requestedAt: request.createdAt,
      ...(whatsappUrl ? { whatsappUrl } : {}),
    };
  }
}
