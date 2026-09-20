import { Injectable, NotFoundException } from '@nestjs/common';
import { IUserRepository } from 'src/account/user.repository';
import { AUDITED_USER_FIELDS } from 'src/account/user.audit-fields';
import { UpdateUserStatusDto } from 'src/account/dtos/update-user-status.dto';
import { UserResponseDto } from 'src/account/dtos/user-response.dto';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { diffFields } from 'src/infra/audit/diff-fields';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { USER_MESSAGES } from 'src/account/user.messages';
import { SessionService } from 'src/security/session/session.service';
import { AuthSessionRevokeReason } from '@prisma/client';

@Injectable()
export class UpdateUserStatusUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly prisma: PrismaService,
    private readonly auditLog: IAuditLogService,
    private readonly sessionService: SessionService,
  ) {}

  async execute(
    id: string,
    dto: UpdateUserStatusDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findUserByIdInOrganization(
      id,
      currentUser.organizationId,
    );

    if (!user) {
      throw new NotFoundException(USER_MESSAGES.notFound(id));
    }

    if (!dto.isActive) {
      // Desativar a conta encerra os acessos abertos, não apenas impede novos.
      await this.sessionService.revokeAllForUser(
        id,
        AuthSessionRevokeReason.ACCOUNT_DISABLED,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.userRepository.update(
        { id, isActive: dto.isActive },
        tx,
      );

      await this.auditLog.record(
        {
          userId: currentUser.id,
          organizationId: currentUser.organizationId,
          entityType: AUDIT_ENTITY_TYPES.USER,
          entityId: id,
          action: dto.isActive
            ? AUDIT_ACTIONS.USER_REACTIVATED
            : AUDIT_ACTIONS.USER_DEACTIVATED,
          ...diffFields(user, updated, AUDITED_USER_FIELDS),
        },
        tx,
      );

      return UserResponseDto.from(updated);
    });
  }
}
