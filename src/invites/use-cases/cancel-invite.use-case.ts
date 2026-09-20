import { Injectable } from '@nestjs/common';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { FindInviteByIdUseCase } from './find-invite-by-id.use-case';
import { IUserInviteRepository } from 'src/invites/domain/interfaces/user-invite.repository.interface';
import { UserInvite } from 'src/invites/domain/entities/user-invite.entity';
import { AUDITED_INVITE_FIELDS } from 'src/invites/invite.audit-fields';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { diffFields, snapshotFields } from 'src/infra/audit/diff-fields';

@Injectable()
export class CancelInviteUseCase {
  constructor(
    private findInviteByIdUseCase: FindInviteByIdUseCase,
    private inviteRepository: IUserInviteRepository,
    private prisma: PrismaService,
    private auditLog: IAuditLogService,
  ) {}

  async execute(
    inviteId: string,
    currentUser: AuthenticatedUserPayload,
  ): Promise<UserInvite> {
    const invite = await this.findInviteByIdUseCase.execute(
      inviteId,
      currentUser,
    );

    const before = snapshotFields(
      invite as unknown as Record<string, unknown>,
      AUDITED_INVITE_FIELDS,
    );

    invite.deactive();

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.inviteRepository.update(invite, tx);

      await this.auditLog.record(
        {
          userId: currentUser.id,
          organizationId: invite.organizationId,
          entityType: AUDIT_ENTITY_TYPES.INTERNAL_USER_INVITE,
          entityId: invite.id,
          action: AUDIT_ACTIONS.INVITE_CANCELLED,
          ...diffFields(
            before,
            updated as unknown as Record<string, unknown>,
            AUDITED_INVITE_FIELDS,
          ),
        },
        tx,
      );

      return updated;
    });
  }
}
