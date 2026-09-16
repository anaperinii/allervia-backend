import { Injectable, NotFoundException } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { Dose } from '@prisma/client';
import { IDoseRepository } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface';
import { DOSE_MESSAGES } from 'src/treatment-protocols/allergen-immunotherapy/dosing/dose.messages';
import { UpdateDoseStatusDto } from 'src/treatment-protocols/allergen-immunotherapy/dosing/dtos/update-dose-status.dto';
import { AUDITED_DOSE_FIELDS } from 'src/treatment-protocols/allergen-immunotherapy/dosing/dose.audit-fields';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { diffFields, snapshotFields } from 'src/infra/audit/diff-fields';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

@Injectable()
export class UpdateDoseStatusUseCase {
  constructor(
    private readonly doseRepository: IDoseRepository,
    private readonly abilityFactory: AbilityFactory,
    private readonly prisma: PrismaService,
    private readonly auditLog: IAuditLogService,
  ) {}

  async execute(
    id: string,
    dto: UpdateDoseStatusDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<Dose> {
    const ability = this.abilityFactory.createForUser(currentUser);
    const where = accessibleBy(ability, 'update').ofType('Dose');

    const dose = await this.doseRepository.findByIdAccessible(id, where);

    if (!dose) {
      throw new NotFoundException(DOSE_MESSAGES.notFound(id));
    }

    const before = snapshotFields(
      dose as unknown as Record<string, unknown>,
      AUDITED_DOSE_FIELDS,
    );

    dose.changeStatus(dto);
    dose.updatedById = currentUser.id;

    return this.prisma.$transaction(async (tx) => {
      const savedDose = await this.doseRepository.update(dose.id, dose, tx);

      const diff = diffFields(
        before,
        savedDose as unknown as Record<string, unknown>,
        AUDITED_DOSE_FIELDS,
      );

      if (diff.changedFields.length > 0) {
        await this.auditLog.record(
          {
            userId: currentUser.id,
            organizationId: currentUser.organizationId,
            entityType: AUDIT_ENTITY_TYPES.DOSE,
            entityId: dose.id,
            action: savedDose.isArchived
              ? AUDIT_ACTIONS.DOSE_ARCHIVED
              : AUDIT_ACTIONS.DOSE_STATUS_CHANGED,
            ...diff,
          },
          tx,
        );
      }

      return savedDose;
    });
  }
}
