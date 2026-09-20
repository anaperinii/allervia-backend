import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { IUserRepository } from '../user.repository';
import { IPasswordHashingService } from 'src/security/interfaces/password-hashing.service.interface';
import { IEmailService } from 'src/infra/email/email.service';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ChangePasswordDto } from '../dtos/change-password.dto';
import { USER_MESSAGES } from '../user.messages';
import { SessionService } from 'src/security/session/session.service';
import { AuthSessionRevokeReason } from '@prisma/client';

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashingService: IPasswordHashingService,
    private readonly emailService: IEmailService,
    private readonly prisma: PrismaService,
    private readonly auditLog: IAuditLogService,
    private readonly sessionService: SessionService,
  ) {}

  async execute(
    currentUser: AuthenticatedUserPayload,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const userId = currentUser.id;
    const user = await this.userRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException(USER_MESSAGES.notFound(userId));
    }

    const isCurrentValid = await this.hashingService.compare(
      dto.currentPassword,
      user.password,
    );

    if (!isCurrentValid) {
      throw new UnauthorizedException(USER_MESSAGES.invalidCurrentPassword);
    }

    const passwordHash = await this.hashingService.hash(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await this.userRepository.changePassword(userId, passwordHash, tx);

      await this.auditLog.record(
        {
          userId,
          organizationId: currentUser.organizationId,
          entityType: AUDIT_ENTITY_TYPES.USER,
          entityId: userId,
          action: AUDIT_ACTIONS.PASSWORD_CHANGED,
        },
        tx,
      );
    });

    // Senha trocada encerra os acessos abertos em outros dispositivos. A
    // versão de autorização já invalida a credencial antiga; a revogação
    // explícita também limpa a lista de dispositivos do usuário.
    await this.sessionService.revokeAllForUser(
      userId,
      AuthSessionRevokeReason.PASSWORD_CHANGED,
    );

    await this.emailService.sendPasswordChangedNotification(user.email);
  }
}
