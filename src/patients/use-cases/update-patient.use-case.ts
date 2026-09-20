import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { Profession } from '@prisma/client';
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
import { normalizeCpf } from '../cpf';

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

    const cpf = dto.cpf === undefined ? undefined : normalizeCpf(dto.cpf);

    if (cpf) {
      // Unicidade por organização: CPF pertence a uma pessoa, não a dois
      // cadastros. A restrição do banco cobre a corrida; a consulta produz o
      // erro legível.
      const holder = await this.prisma.patient.findFirst({
        where: {
          organizationId: patient.organizationId,
          cpf,
          id: { not: id },
        },
        select: { id: true },
      });

      if (holder) {
        throw new ConflictException(PATIENT_MESSAGES.cpfAlreadyRegistered);
      }
    }

    if (dto.responsiblePhysicianId) {
      // O novo responsável precisa ser um médico da mesma organização; o
      // identificador vindo do cliente não prova o vínculo.
      const physician = await this.prisma.professional.findFirst({
        where: {
          id: dto.responsiblePhysicianId,
          organizationId: patient.organizationId,
          profession: Profession.PHYSICIAN,
        },
        select: { id: true },
      });

      if (!physician) {
        throw new NotFoundException(PATIENT_MESSAGES.physicianNotFound);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.patientRepository.update(
        id,
        {
          fullName: dto.fullName,
          birthDate: dto.birthDate,
          weightInKg: dto.weightInKg,
          phoneNumber: dto.phoneNumber,
          cpf,
          responsiblePhysicianId: dto.responsiblePhysicianId,
          updatedById: currentUser.id,
        },
        tx,
      );

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
