import {
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthSessionRevokeReason, VerificationPurpose } from '@prisma/client';
import { EmailChangeConfirmDTO } from '../dtos/email-change-confirm.dto';
import { SecurityUtil } from 'src/utils/security.utils';
import { IUserAuthRepository } from '../interfaces/user-auth.repository.interface';
import { IEmailService } from 'src/infra/email/email.service';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { AUTH_ERROR_CODES, AUTH_MESSAGES } from '../auth.messages';
import { CodedHttpException } from 'src/infra/exceptions/coded.exception';

@Injectable()
export class EmailChangeConfirmUseCase {
  private readonly logger = new Logger(EmailChangeConfirmUseCase.name);

  constructor(
    private readonly authRepository: IUserAuthRepository,
    private readonly emailService: IEmailService,
    private readonly prisma: PrismaService,
    private readonly auditLog: IAuditLogService,
  ) {}

  async execute(dto: EmailChangeConfirmDTO): Promise<{ newEmail: string }> {
    const token = await this.authRepository.findActiveVerificationToken(
      SecurityUtil.sha256(dto.token),
      VerificationPurpose.EMAIL_CHANGE,
      true,
    );

    if (!token || !token.newEmail) {
      throw new NotFoundException(
        AUTH_MESSAGES.invalidOrExpiredEmailChangeToken,
      );
    }

    const newEmail = token.newEmail;
    const previousEmail = token.userEmail;

    const organizationId = await this.authRepository.findOrganizationIdByUserId(
      token.userId,
    );

    if (!organizationId) {
      throw new ConflictException(AUTH_MESSAGES.organizationNotSet);
    }

    const taken = await this.prisma.user.findFirst({
      where: { email: { equals: newEmail, mode: 'insensitive' } },
      select: { id: true },
    });

    if (taken && taken.id !== token.userId) {
      throw new CodedHttpException(
        HttpStatus.CONFLICT,
        AUTH_ERROR_CODES.emailAlreadyInUse,
        AUTH_MESSAGES.emailAlreadyInUse,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.authRepository.finalizeEmailChange(
        token.id,
        token.userId,
        newEmail,
        tx,
      );

      await tx.authSession.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: AuthSessionRevokeReason.EMAIL_CHANGED,
        },
      });

      await this.auditLog.record(
        {
          userId: token.userId,
          organizationId,
          entityType: AUDIT_ENTITY_TYPES.USER,
          entityId: token.userId,
          action: AUDIT_ACTIONS.EMAIL_CHANGE_CONFIRMED,
          oldValues: { email: previousEmail },
          newValues: { email: newEmail },
          changedFields: ['email'],
        },
        tx,
      );
    });

    try {
      await this.emailService.sendEmailChangeFarewell(previousEmail, newEmail);
    } catch {
      this.logger.error('Falha ao notificar o endereço anterior.');
    }

    try {
      await this.emailService.sendEmailChangeWelcome(newEmail);
    } catch {
      this.logger.error('Falha ao notificar o novo endereço.');
    }

    return { newEmail };
  }
}
