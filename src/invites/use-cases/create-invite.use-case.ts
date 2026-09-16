import { ConflictException, Injectable } from '@nestjs/common';
import { InviteStrategyContext } from 'src/invites/strategies/invites/invite-strategy.context';
import { CreateInviteDto } from 'src/invites/dtos/create-invite.dto';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ulid } from 'ulid';
import { ValidateUserEmailUseCase } from 'src/account/use-cases/validate-user-email.use-case';
import { FindUserByIdUseCase } from 'src/account/use-cases/find-user-by-id.use-case';
import { UserInvite } from 'src/invites/domain/entities/user-invite.entity';
import { InviteResponseDto } from 'src/invites/dtos/invite-response.dto';
import { IUserInviteRepository } from 'src/invites/domain/interfaces/user-invite.repository.interface';
import { INVITE_MESSAGES } from 'src/invites/invite.messages';
import { AUDITED_INVITE_FIELDS } from 'src/invites/invite.audit-fields';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { snapshotFields } from 'src/infra/audit/diff-fields';
import { FindActiveInviteUseCase } from './find-active-invite.use-case';

@Injectable()
export class CreateInviteUseCase {
  constructor(
    private validationContext: InviteStrategyContext,
    private findUserById: FindUserByIdUseCase,
    private validateUserEmail: ValidateUserEmailUseCase,
    private inviteRepository: IUserInviteRepository,
    private findActiveInviteUseCase: FindActiveInviteUseCase,
    private prisma: PrismaService,
    private auditLog: IAuditLogService,
  ) {}

  async execute(
    dto: CreateInviteDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<InviteResponseDto> {
    const organizationId =
      await this.validationContext.validateAndGetOrganizationId(
        dto,
        currentUser,
      );

    const user = await this.validateUserEmail.execute(dto.email, currentUser);

    if (user && user.isActive) {
      throw new ConflictException(INVITE_MESSAGES.emailAlreadyActive);
    }

    const existingInvite = await this.findActiveInviteUseCase.execute(
      dto.email,
      organizationId,
    );

    if (existingInvite) {
      throw new ConflictException(
        `Já existe um convite ativo para ${dto.email} nesta organização`,
      );
    }

    const token = ulid();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 5. TODO: Disparar evento para envio de email
    // this.eventEmitter.emit('invite.created', { invite, inviteLink });

    const createdByUser = await this.findUserById.execute(
      currentUser.id,
      currentUser,
    );

    const invite = UserInvite.createNew({
      email: dto.email,
      fullName: dto.fullName,
      role: dto.userRole,
      organizationId,
      createdById: createdByUser.id,
      token,
      expiresAt,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const persisted = await this.inviteRepository.create(invite, tx);

      await this.auditLog.record(
        {
          userId: currentUser.id,
          organizationId,
          entityType: AUDIT_ENTITY_TYPES.INTERNAL_USER_INVITE,
          entityId: persisted.id,
          action: AUDIT_ACTIONS.INVITE_CREATED,
          newValues: snapshotFields(
            persisted as unknown as Record<string, unknown>,
            AUDITED_INVITE_FIELDS,
          ),
          changedFields: [...AUDITED_INVITE_FIELDS],
        },
        tx,
      );

      return persisted;
    });

    const inviteData = {
      ...created,
      createdById: createdByUser.id,
      createdByEmail: createdByUser.email,
    };

    return inviteData;
  }
}
