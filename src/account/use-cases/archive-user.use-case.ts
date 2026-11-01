import { UserResponseDto } from 'src/account/dtos/user-response.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { IUserRepository } from 'src/account/user.repository';
import { AUDITED_USER_FIELDS } from 'src/account/user.audit-fields';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { diffFields } from 'src/infra/audit/diff-fields';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { USER_MESSAGES } from 'src/account/user.messages';

@Injectable()
export class ArchiveUserUseCase {
  constructor(
    private userRepository: IUserRepository,
    private prisma: PrismaService,
    private auditLog: IAuditLogService,
  ) {}

  async execute(
    id: string,
    currentUser: AuthenticatedUserPayload,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findUserByIdInOrganization(
      id,
      currentUser.organizationId,
    );

    if (!user) {
      throw new NotFoundException(USER_MESSAGES.notFound(id));
    }

    return this.prisma.$transaction(async (tx) => {
      const archived = await this.userRepository.update(
        { id, isArchived: true, isActive: false },
        tx,
      );

      await this.auditLog.record(
        {
          userId: currentUser.id,
          organizationId: currentUser.organizationId,
          entityType: AUDIT_ENTITY_TYPES.USER,
          entityId: id,
          action: AUDIT_ACTIONS.USER_ARCHIVED,
          ...diffFields(user, archived, AUDITED_USER_FIELDS),
        },
        tx,
      );

      return UserResponseDto.from(archived);
    });
  }
}
