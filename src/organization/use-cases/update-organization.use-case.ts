import {
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

/**
 * Atualiza a própria organização. O alvo vem do vínculo do ator, nunca de um
 * identificador livre no corpo ou na rota.
 */
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

    const current = await this.prisma.organization.findUnique({
      where: { id: currentUser.organizationId },
    });

    if (!current) {
      throw new NotFoundException(
        ORGANIZATION_MESSAGES.notFound(currentUser.organizationId),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: current.id },
        data: { name: dto.name, timeZone: dto.timeZone },
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
