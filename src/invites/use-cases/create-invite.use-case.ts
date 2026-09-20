import { ConflictException, Injectable } from '@nestjs/common';
import { InviteStrategyContext } from 'src/invites/strategies/invites/invite-strategy.context';
import { CreateInviteDto } from 'src/invites/dtos/create-invite.dto';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { randomBytes } from 'node:crypto';
import { ValidateUserEmailUseCase } from 'src/account/use-cases/validate-user-email.use-case';
import { UserInvite } from 'src/invites/domain/entities/user-invite.entity';
import {
  InviteResponseDto,
  resolveInviteStatus,
} from 'src/invites/dtos/invite-response.dto';
import { IUserInviteRepository } from 'src/invites/domain/interfaces/user-invite.repository.interface';
import { INVITE_MESSAGES } from 'src/invites/invite.messages';
import { AUDITED_INVITE_FIELDS } from 'src/invites/invite.audit-fields';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { snapshotFields } from 'src/infra/audit/diff-fields';
import { IEmailService } from 'src/infra/email/email.service';
import { FindActiveInviteUseCase } from './find-active-invite.use-case';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class CreateInviteUseCase {
  constructor(
    private validationContext: InviteStrategyContext,
    private validateUserEmail: ValidateUserEmailUseCase,
    private inviteRepository: IUserInviteRepository,
    private findActiveInviteUseCase: FindActiveInviteUseCase,
    private prisma: PrismaService,
    private auditLog: IAuditLogService,
    private emailService: IEmailService,
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

    const email = dto.email.trim().toLowerCase();
    const user = await this.validateUserEmail.execute(email, currentUser);

    if (user && user.isActive) {
      throw new ConflictException(INVITE_MESSAGES.emailAlreadyActive);
    }

    const existingInvite = await this.findActiveInviteUseCase.execute(
      email,
      organizationId,
    );

    if (existingInvite) {
      throw new ConflictException(INVITE_MESSAGES.alreadyInvited(email));
    }

    // Token com entropia de CSPRNG: ele é a credencial que autoriza o cadastro.
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

    const invite = UserInvite.createNew({
      email,
      fullName: dto.fullName,
      role: dto.userRole,
      organizationId,
      createdById: currentUser.id,
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

    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    });

    // O token vai por e-mail ao convidado. Quem convidou não o recebe de volta:
    // a resposta descreve o convite, não dá acesso a ele.
    await this.emailService.sendInviteLink({
      email,
      fullName: dto.fullName,
      organizationName: organization.name,
      token,
      expiresAt,
    });

    return {
      id: created.id,
      email: created.email,
      fullName: created.fullName,
      role: created.role,
      status: resolveInviteStatus(created),
      expiresAt: created.expiresAt,
      usedAt: created.usedAt,
      createdAt: created.createdAt,
      createdBy: { id: currentUser.id, email: currentUser.email },
    };
  }
}
