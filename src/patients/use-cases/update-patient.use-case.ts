import { Injectable, NotFoundException } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { PatientRepository } from 'src/patients/patient.repository';
import { PATIENT_MESSAGES } from 'src/patients/patient.messages';
import { AUDITED_PATIENT_FIELDS } from 'src/patients/patient.audit-fields';
import { UpdatePatientDto } from 'src/patients/dtos/update-patient.dto';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { diffFields } from 'src/infra/audit/diff-fields';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

@Injectable()
export class UpdatePatientUseCase {
  constructor(
    private patientRepository: PatientRepository,
    private abilityFactory: AbilityFactory,
    private prisma: PrismaService,
    private auditLog: IAuditLogService,
  ) {}

  async execute(
    id: string,
    dto: UpdatePatientDto,
    currentUser: AuthenticatedUserPayload,
  ) {
    const ability = this.abilityFactory.createForUser(currentUser);
    const where = accessibleBy(ability, 'update').ofType('Patient');

    const patient = await this.patientRepository.findByIdAccessible(id, where);

    if (!patient) {
      throw new NotFoundException(PATIENT_MESSAGES.notFound(id));
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.patientRepository.update(id, dto, tx);

      const diff = diffFields(patient, updated, AUDITED_PATIENT_FIELDS);

      if (diff.changedFields.length > 0) {
        await this.auditLog.record(
          {
            userId: currentUser.id,
            organizationId: currentUser.organizationId,
            entityType: AUDIT_ENTITY_TYPES.PATIENT,
            entityId: id,
            action: AUDIT_ACTIONS.PATIENT_UPDATED,
            ...diff,
          },
          tx,
        );
      }

      return updated;
    });
  }
}
