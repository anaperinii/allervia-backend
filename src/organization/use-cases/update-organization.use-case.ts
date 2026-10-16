import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { diffFields } from 'src/infra/audit/diff-fields';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { AUTH_MESSAGES } from 'src/security/auth.messages';
import { UpdateOrganizationDto } from '../dtos/update-organization.dto';
import { OrganizationResponseDto } from '../dtos/organization-response.dto';
import { ORGANIZATION_MESSAGES } from '../organization.messages';

@Injectable()
export class UpdateOrganizationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: IAuditLogService,
  ) {}

  async execute(
    dto: UpdateOrganizationDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<OrganizationResponseDto> {
    if (!currentUser.organizationId) {
      throw new ForbiddenException(AUTH_MESSAGES.organizationNotSet);
    }

    return this.prisma.$transaction(async (tx) => {

      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${currentUser.organizationId} FOR NO KEY UPDATE`;
      const current = await tx.organization.findUnique({
        where: { id: currentUser.organizationId },
      });

      if (!current) {
        throw new NotFoundException(
          ORGANIZATION_MESSAGES.notFound(currentUser.organizationId),
        );
      }

      if (
        dto.expectedRevision !== undefined &&
        current.revision !== dto.expectedRevision
      ) {
        throw new ConflictException('STALE_ORGANIZATION_REVISION');
      }

      const updated = await tx.organization.update({
        where: { id: current.id },
        data: {
          name: dto.name,
          timeZone: dto.timeZone,
          revision: { increment: 1 },
        },
      });

      const changes = diffFields(current, updated, ['name', 'timeZone']);

      if (changes.changedFields.length > 0) {
        await this.auditLog.record(
          {
            userId: currentUser.id,
            organizationId: current.id,
            entityType: AUDIT_ENTITY_TYPES.ORGANIZATION,
            entityId: current.id,
            action: AUDIT_ACTIONS.ORGANIZATION_UPDATED,
            ...changes,
          },
          tx,
        );
      }

      return updated;
    });
  }
}
