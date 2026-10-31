import {
  HttpStatus,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NotificationKind, VerificationPurpose } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { enqueueEmailChangeOutbox } from 'src/notifications/notifications.service';
import { IUserAuthRepository } from 'src/security/interfaces/user-auth.repository.interface';
import { AUTH_ERROR_CODES, AUTH_MESSAGES } from 'src/security/auth.messages';
import {
  CodedHttpException,
  CodedTooManyRequestsException,
} from 'src/infra/exceptions/coded.exception';
import { SecurityUtil } from 'src/utils/security.utils';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { PROFESSIONAL_MESSAGES } from '../professional.messages';
import {
  EmailChangeRequestDto,
  type EmailChangeChannel,
} from '../dtos/request-email-change.dto';
import { EmailChangeDispatcherService } from '../email-change-dispatcher.service';

export const EMAIL_CHANGE_CONFIRMATION_TTL_MINUTES = 60;
export const EMAIL_CHANGE_PENDING_TTL_DAYS = 7;

const EMISSION_LIMITS = [
  { windowSeconds: 60, max: 1 },
  { windowSeconds: 15 * 60, max: 3 },
  { windowSeconds: 60 * 60, max: 5 },
];

export interface RequestEmailChangeParams {
  professionalId: string;
  newEmail: string;
  initiator: 'admin' | 'self';
  channel?: EmailChangeChannel;
  currentUser: AuthenticatedUserPayload;
}

@Injectable()
export class RequestEmailChangeUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authRepository: IUserAuthRepository,
    private readonly auditLog: IAuditLogService,
    private readonly dispatcher: EmailChangeDispatcherService,
  ) {}

  async execute(
    params: RequestEmailChangeParams,
  ): Promise<EmailChangeRequestDto> {
    const professional = await this.prisma.professional.findFirst({
      where: {
        id: params.professionalId,
        organizationId: params.currentUser.organizationId,
      },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        userId: true,
        user: { select: { email: true } },
      },
    });

    if (!professional) {
      throw new NotFoundException(
        PROFESSIONAL_MESSAGES.notFound(params.professionalId),
      );
    }

    const newEmail = params.newEmail.trim().toLowerCase();
    const currentEmail = professional.user.email;

    if (newEmail === currentEmail.toLowerCase()) {
      throw new CodedHttpException(
        HttpStatus.BAD_REQUEST,
        AUTH_ERROR_CODES.emailSameAsCurrent,
        AUTH_MESSAGES.emailSameAsCurrent,
      );
    }

    await this.assertEmailAvailable(newEmail, professional.userId);
    await this.assertNotThrottled(professional.userId);

    if (params.initiator === 'admin' && !params.channel) {
      throw new BadRequestException(PROFESSIONAL_MESSAGES.channelRequired);
    }

    const approved = params.initiator === 'admin';
    const token = SecurityUtil.generateSecureToken();
    const expiresAt = approved
      ? minutesFromNow(EMAIL_CHANGE_CONFIRMATION_TTL_MINUTES)
      : daysFromNow(EMAIL_CHANGE_PENDING_TTL_DAYS);

    await this.authRepository.createVerificationToken({
      userId: professional.userId,
      purpose: VerificationPurpose.EMAIL_CHANGE,
      tokenHash: SecurityUtil.sha256(token),
      newEmail,
      expiresAt,
      requestedById: params.currentUser.id,
      approvedAt: approved ? new Date() : null,
      approvedById: approved ? params.currentUser.id : null,
    });

    const created = await this.prisma.verificationToken.findFirstOrThrow({
      where: {
        userId: professional.userId,
        purpose: VerificationPurpose.EMAIL_CHANGE,
        tokenHash: SecurityUtil.sha256(token),
      },
      select: { id: true, createdAt: true, expiresAt: true },
    });

    await this.auditLog.record({
      userId: params.currentUser.id,
      organizationId: params.currentUser.organizationId,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: professional.userId,
      action: AUDIT_ACTIONS.EMAIL_CHANGE_REQUESTED,
      oldValues: { email: currentEmail },
      newValues: { email: newEmail },
      changedFields: ['email'],
    });

    let whatsappUrl: string | undefined;

    if (approved) {
      whatsappUrl = await this.dispatcher.dispatch({
        channel: params.channel as EmailChangeChannel,
        token,
        fullName: professional.fullName,
        currentEmail,
        newEmail,
        phoneNumber: professional.phoneNumber,
      });
    } else {
      await this.notifyAdministrators({
        organizationId: params.currentUser.organizationId,
        verificationTokenId: created.id,
        professionalId: professional.id,
        professionalName: professional.fullName,
        newEmail,
      });
    }

    return {
      id: created.id,
      professionalId: professional.id,
      professionalName: professional.fullName,
      currentEmail,
      newEmail,
      status: approved ? 'DISPATCHED' : 'PENDING',
      expiresAt: created.expiresAt,
      requestedAt: created.createdAt,
      ...(whatsappUrl ? { whatsappUrl } : {}),
    };
  }

  private async assertEmailAvailable(
    newEmail: string,
    ownerUserId: string,
  ): Promise<void> {
    const taken = await this.prisma.user.findFirst({
      where: { email: { equals: newEmail, mode: 'insensitive' } },
      select: { id: true },
    });

    if (taken && taken.id !== ownerUserId) {
      throw new CodedHttpException(
        HttpStatus.CONFLICT,
        AUTH_ERROR_CODES.emailAlreadyInUse,
        AUTH_MESSAGES.emailAlreadyInUse,
      );
    }
  }

  private async assertNotThrottled(userId: string): Promise<void> {
    for (const limit of EMISSION_LIMITS) {
      const since = new Date(Date.now() - limit.windowSeconds * 1000);
      const count = await this.authRepository.countRecentVerificationTokens(
        userId,
        VerificationPurpose.EMAIL_CHANGE,
        since,
      );
      if (count >= limit.max) {
        throw new CodedTooManyRequestsException(
          AUTH_ERROR_CODES.tooManyAttempts,
          AUTH_MESSAGES.tooManyAttempts,
        );
      }
    }
  }

  private async notifyAdministrators(params: {
    organizationId: string;
    verificationTokenId: string;
    professionalId: string;
    professionalName: string;
    newEmail: string;
  }): Promise<void> {
    const administrators = await this.prisma.professional.findMany({
      where: {
        organizationId: params.organizationId,
        professionalRoles: { some: { role: 'ADMINISTRATOR', revokedAt: null } },
      },
      select: { id: true },
    });

    if (administrators.length === 0) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await enqueueEmailChangeOutbox(
        tx,
        params.organizationId,
        NotificationKind.EMAIL_CHANGE_REQUEST_PENDING,
        {
          verificationTokenId: params.verificationTokenId,
          professionalId: params.professionalId,
          professionalName: params.professionalName,
          newEmail: params.newEmail,
          recipientProfessionalIds: administrators.map((admin) => admin.id),
        },
      );
    });
  }
}

function minutesFromNow(minutes: number): Date {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}
