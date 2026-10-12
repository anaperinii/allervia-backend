import { Injectable } from '@nestjs/common';
import { AUDITED_USER_FIELDS } from 'src/account/user.audit-fields';
import { UpdateUserStatusDto } from 'src/account/dtos/update-user-status.dto';
import { UserResponseDto } from 'src/account/dtos/user-response.dto';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { diffFields } from 'src/infra/audit/diff-fields';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { UserAccessService } from 'src/account/user-access.service';

@Injectable()
export class UpdateUserStatusUseCase {
  constructor(
    private readonly userAccess: UserAccessService,
    private readonly auditLog: IAuditLogService,
  ) {}

  async execute(
    id: string,
    dto: UpdateUserStatusDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<UserResponseDto> {
    const result = await this.userAccess.setActive(
      id,
      dto.isActive,
      currentUser,
      async (tx, before, after) => {
        await this.auditLog.record(
          {
            userId: currentUser.id,
            organizationId: currentUser.organizationId,
            entityType: AUDIT_ENTITY_TYPES.USER,
            entityId: id,
            action: dto.isActive
              ? AUDIT_ACTIONS.USER_REACTIVATED
              : AUDIT_ACTIONS.USER_DEACTIVATED,
            ...diffFields(before, after, AUDITED_USER_FIELDS),
          },
          tx,
        );
      },
    );

    return UserResponseDto.from(result.after);
  }
}
