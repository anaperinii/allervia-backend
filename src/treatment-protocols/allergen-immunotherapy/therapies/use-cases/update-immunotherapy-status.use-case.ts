import { Injectable, NotFoundException } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { IImmunotherapyRepository } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface';
import { UpdateImmunotherapyStatusDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/update-immunotherapy-status.dto';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ImmunotherapyResponseDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/immunotherapy-response.dto';
import { IMMUNOTHERAPY_MESSAGES } from 'src/treatment-protocols/allergen-immunotherapy/therapies/immunotherapy.messages';
import { AUDITED_IMMUNOTHERAPY_FIELDS } from 'src/treatment-protocols/allergen-immunotherapy/therapies/immunotherapy.audit-fields';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { diffFields, snapshotFields } from 'src/infra/audit/diff-fields';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';

@Injectable()
export class UpdateImmunotherapyStatusUseCase {
  constructor(
    private readonly immunotherapyRepository: IImmunotherapyRepository,
    private readonly abilityFactory: AbilityFactory,
    private readonly prisma: PrismaService,
    private readonly auditLog: IAuditLogService,
  ) {}

  async execute(
    id: string,
    dto: UpdateImmunotherapyStatusDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyResponseDto> {
    const ability = this.abilityFactory.createForUser(currentUser);
    const where = accessibleBy(ability, 'update').ofType('Immunotherapy');

    const immunotherapy = await this.immunotherapyRepository.findByIdAccessible(
      id,
      where,
    );

    if (!immunotherapy) {
      throw new NotFoundException(IMMUNOTHERAPY_MESSAGES.notFound(id));
    }

    const before = snapshotFields(
      immunotherapy as unknown as Record<string, unknown>,
      AUDITED_IMMUNOTHERAPY_FIELDS,
    );

    immunotherapy.updateStatus(dto.status, currentUser.id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.immunotherapyRepository.update(
        immunotherapy.id,
        immunotherapy,
        tx,
      );

      const diff = diffFields(
        before,
        updated as unknown as Record<string, unknown>,
        AUDITED_IMMUNOTHERAPY_FIELDS,
      );

      if (diff.changedFields.length > 0) {
        await this.auditLog.record(
          {
            userId: currentUser.id,
            organizationId: currentUser.organizationId,
            entityType: AUDIT_ENTITY_TYPES.IMMUNOTHERAPY,
            entityId: immunotherapy.id,
            action: updated.isArchived
              ? AUDIT_ACTIONS.IMMUNOTHERAPY_ARCHIVED
              : AUDIT_ACTIONS.IMMUNOTHERAPY_STATUS_CHANGED,
            ...diff,
          },
          tx,
        );
      }

      return updated;
    });
  }
}
