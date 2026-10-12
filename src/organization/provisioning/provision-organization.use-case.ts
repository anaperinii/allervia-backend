import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IEmailService } from 'src/infra/email/email.service';
import { ORGANIZATION_MESSAGES } from '../organization.messages';
import {
  ProvisionOrganizationDto,
  ProvisionedOrganizationDto,
} from './dtos/provision-organization.dto';
import { resolveSystemActor } from './system-actor';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class ProvisionOrganizationUseCase {
  private readonly logger = new Logger(ProvisionOrganizationUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: IAuditLogService,
    private readonly emailService: IEmailService,
    private readonly config: ConfigService,
  ) {}

  async execute(
    dto: ProvisionOrganizationDto,
  ): Promise<ProvisionedOrganizationDto> {
    const email = dto.administrator.email.trim().toLowerCase();
    const taxId = dto.organization.taxId.replace(/\D/g, '');

    await this.assertAvailable(dto.organization.name, taxId, email);

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

    const result = await this.prisma.$transaction(async (tx) => {
      const systemUserId = await resolveSystemActor(tx, this.config);
      const organization = await tx.organization.create({
        data: { name: dto.organization.name, taxId },
        select: { id: true, name: true, taxId: true },
      });

      const invite = await tx.internalUserInvite.create({
        data: {
          organizationId: organization.id,
          email,
          fullName: dto.administrator.fullName,
          role: Role.ADMINISTRATOR,
          token,
          expiresAt,
          createdById: systemUserId,
        },
        select: { id: true, email: true, role: true, expiresAt: true },
      });

      await this.auditLog.record(
        {
          userId: systemUserId,
          organizationId: organization.id,
          entityType: AUDIT_ENTITY_TYPES.ORGANIZATION,
          entityId: organization.id,
          action: AUDIT_ACTIONS.ORGANIZATION_PROVISIONED,
          newValues: {
            organizationName: organization.name,
            administratorInviteId: invite.id,
            administratorEmail: invite.email,
          },
          changedFields: ['organization', 'administratorInvite'],
        },
        tx,
      );

      return { organization, invite };
    });

    let inviteEmailDelivered = true;
    try {
      await this.emailService.sendInviteLink({
        email,
        fullName: dto.administrator.fullName,
        organizationName: result.organization.name,
        token,
        expiresAt,
      });
    } catch {
      inviteEmailDelivered = false;
      this.logger.error(
        `Falha ao enviar convite de administrador da organização ${result.organization.id} (convite ${result.invite.id}); use o reenvio de convite.`,
      );
    }

    return {
      organization: result.organization,
      administratorInvite: {
        id: result.invite.id,
        email: result.invite.email,
        role: result.invite.role,
        expiresAt: result.invite.expiresAt,
      },
      inviteEmailDelivered,
    };
  }

  private async assertAvailable(
    name: string,
    taxId: string,
    email: string,
  ): Promise<void> {
    const [byName, byTaxId, byEmail] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { name },
        select: { id: true },
      }),
      this.prisma.organization.findUnique({
        where: { taxId },
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      }),
    ]);

    if (byName) {
      throw new ConflictException(
        ORGANIZATION_MESSAGES.alreadyExists('name', name),
      );
    }

    if (byTaxId) {
      throw new ConflictException(
        ORGANIZATION_MESSAGES.alreadyExists('taxId', taxId),
      );
    }

    if (byEmail) {
      throw new ConflictException(
        ORGANIZATION_MESSAGES.administratorEmailTaken,
      );
    }
  }
}
