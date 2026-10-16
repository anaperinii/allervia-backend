import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { snapshotFields } from 'src/infra/audit/diff-fields';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IEmailService } from 'src/infra/email/email.service';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { AUDITED_INVITE_FIELDS } from 'src/invites/invite.audit-fields';
import { INVITE_MESSAGES } from 'src/invites/invite.messages';
import {
  InviteResponseDto,
  resolveInviteStatus,
} from 'src/invites/dtos/invite-response.dto';
import { FindInviteByIdUseCase } from './find-invite-by-id.use-case';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class ResendInviteUseCase {
  private readonly logger = new Logger(ResendInviteUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: IAuditLogService,
    private readonly emailService: IEmailService,
    private readonly findInviteById: FindInviteByIdUseCase,
  ) {}

  async execute(
    inviteId: string,
    currentUser: AuthenticatedUserPayload,
  ): Promise<InviteResponseDto> {
    const current = await this.findInviteById.execute(inviteId, currentUser);

    if (current.isUsed() || current.isDeactive()) {
      throw new ConflictException(INVITE_MESSAGES.resendNotAvailable);
    }

    const reissued = current.isExpired();
    const invite = reissued
      ? await this.reissue(current, currentUser)
      : await this.prisma.internalUserInvite.findUniqueOrThrow({
          where: { id: current.id },
        });

    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: invite.organizationId },
      select: { name: true },
    });

    let emailDelivered = true;
    try {
      await this.emailService.sendInviteLink({
        email: invite.email,
        fullName: invite.fullName,
        organizationName: organization.name,
        token: invite.token,
        expiresAt: invite.expiresAt,
      });
    } catch {
      emailDelivered = false;
      this.logger.error(`Falha ao reenviar convite ${invite.id}.`);
    }

    return {
      id: invite.id,
      email: invite.email,
      fullName: invite.fullName,
      role: invite.role,
      status: resolveInviteStatus(invite),
      expiresAt: invite.expiresAt,
      usedAt: invite.usedAt,
      createdAt: invite.createdAt,
      emailDelivered,
      reissued,
    };
  }

  private async reissue(
    expired: {
      id: string;
      organizationId: string;
      email: string;
      fullName: string;
      role: Role;
    },
    currentUser: AuthenticatedUserPayload,
  ) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

    return this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.internalUserInvite.updateMany({
        where: { id: expired.id, isActive: true, usedAt: null },
        data: { isActive: false },
      });
      if (cancelled.count !== 1) {

        throw new ConflictException(INVITE_MESSAGES.resendNotAvailable);
      }

      await this.auditLog.record(
        {
          userId: currentUser.id,
          organizationId: expired.organizationId,
          entityType: AUDIT_ENTITY_TYPES.INTERNAL_USER_INVITE,
          entityId: expired.id,
          action: AUDIT_ACTIONS.INVITE_CANCELLED,
          oldValues: { isActive: true },
          newValues: { isActive: false },
          changedFields: ['isActive'],
        },
        tx,
      );

      const fresh = await tx.internalUserInvite.create({
        data: {
          organizationId: expired.organizationId,
          email: expired.email,
          fullName: expired.fullName,
          role: expired.role,
          token,
          expiresAt,
          createdById: currentUser.id,
        },
      });

      await this.auditLog.record(
        {
          userId: currentUser.id,
          organizationId: expired.organizationId,
          entityType: AUDIT_ENTITY_TYPES.INTERNAL_USER_INVITE,
          entityId: fresh.id,
          action: AUDIT_ACTIONS.INVITE_CREATED,
          newValues: snapshotFields(
            fresh as unknown as Record<string, unknown>,
            AUDITED_INVITE_FIELDS,
          ),
          changedFields: [...AUDITED_INVITE_FIELDS],
        },
        tx,
      );

      return fresh;
    });
  }
}
