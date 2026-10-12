import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { snapshotFields } from 'src/infra/audit/diff-fields';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IEmailService } from 'src/infra/email/email.service';
import { AUDITED_INVITE_FIELDS } from 'src/invites/invite.audit-fields';
import { ORGANIZATION_MESSAGES } from '../organization.messages';
import { ResendAdministratorInviteResponseDto } from './dtos/provision-organization.dto';
import { resolveSystemActor } from './system-actor';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class ResendOrganizationInviteUseCase {
  private readonly logger = new Logger(ResendOrganizationInviteUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: IAuditLogService,
    private readonly emailService: IEmailService,
    private readonly config: ConfigService,
  ) {}

  async execute(
    organizationId: string,
  ): Promise<ResendAdministratorInviteResponseDto> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });
    if (!organization) {
      throw new NotFoundException(
        ORGANIZATION_MESSAGES.notFound(organizationId),
      );
    }

    const current = await this.prisma.internalUserInvite.findFirst({
      where: {
        organizationId,
        role: Role.ADMINISTRATOR,
        isActive: true,
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!current) {
      throw new NotFoundException(
        ORGANIZATION_MESSAGES.administratorInviteNotFound,
      );
    }

    const reissued = current.expiresAt < new Date();
    const invite = reissued ? await this.reissue(current) : current;

    let inviteEmailDelivered = true;
    try {
      await this.emailService.sendInviteLink({
        email: invite.email,
        fullName: invite.fullName,
        organizationName: organization.name,
        token: invite.token,
        expiresAt: invite.expiresAt,
      });
    } catch (error) {
      inviteEmailDelivered = false;
      this.logger.error(
        `Falha ao reenviar convite de administrador da organização ${organizationId} (convite ${invite.id}).`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return {
      administratorInvite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
      inviteEmailDelivered,
      reissued,
    };
  }

  private async reissue(expired: {
    id: string;
    organizationId: string;
    email: string;
    fullName: string;
    role: Role;
  }) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

    return this.prisma.$transaction(async (tx) => {
      const systemUserId = await resolveSystemActor(tx, this.config);

      const cancelled = await tx.internalUserInvite.update({
        where: { id: expired.id },
        data: { isActive: false },
      });

      await this.auditLog.record(
        {
          userId: systemUserId,
          organizationId: expired.organizationId,
          entityType: AUDIT_ENTITY_TYPES.INTERNAL_USER_INVITE,
          entityId: expired.id,
          action: AUDIT_ACTIONS.INVITE_CANCELLED,
          oldValues: { isActive: true },
          newValues: { isActive: cancelled.isActive },
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
          createdById: systemUserId,
        },
      });

      await this.auditLog.record(
        {
          userId: systemUserId,
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
