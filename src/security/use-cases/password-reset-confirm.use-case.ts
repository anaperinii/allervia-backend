import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthSessionRevokeReason, VerificationPurpose } from '@prisma/client';
import { PasswordResetConfirmDTO } from '../dtos/password-reset-confirm.dto';
import { SecurityUtil } from 'src/utils/security.utils';
import { IUserAuthRepository } from '../interfaces/user-auth.repository.interface';
import { IPasswordHashingService } from '../interfaces/password-hashing.service.interface';
import { IEmailService } from 'src/infra/email/email.service';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { AUTH_MESSAGES } from '../auth.messages';

@Injectable()
export class PasswordResetConfirmUseCase {
  constructor(
    private readonly authRepository: IUserAuthRepository,
    private readonly hashingService: IPasswordHashingService,
    private readonly emailService: IEmailService,
    private readonly prisma: PrismaService,
    private readonly auditLog: IAuditLogService,
  ) {}

  async execute(dto: PasswordResetConfirmDTO): Promise<void> {
    const token = await this.authRepository.findActiveVerificationToken(
      SecurityUtil.sha256(dto.token),
      VerificationPurpose.PASSWORD_RESET,
    );

    if (!token) {
      throw new NotFoundException(AUTH_MESSAGES.invalidOrExpiredResetToken);
    }

    const organizationId = await this.authRepository.findOrganizationIdByUserId(
      token.userId,
    );

    if (!organizationId) {
      throw new ConflictException(AUTH_MESSAGES.organizationNotSet);
    }

    const passwordHash = await this.hashingService.hash(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await this.authRepository.finalizePasswordReset(
        token.id,
        token.userId,
        passwordHash,
        tx,
      );

      await tx.authSession.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: AuthSessionRevokeReason.PASSWORD_CHANGED,
        },
      });

      await this.auditLog.record(
        {
          userId: token.userId,
          organizationId,
          entityType: AUDIT_ENTITY_TYPES.USER,
          entityId: token.userId,
          action: AUDIT_ACTIONS.PASSWORD_RESET,
        },
        tx,
      );
    });

    await this.emailService.sendPasswordChangedNotification(token.userEmail);
  }
}
