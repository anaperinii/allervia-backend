import { ConflictException, Injectable } from '@nestjs/common';
import { PatientRepository } from 'src/patients/patient.repository';
import { CreatePatientDto } from 'src/patients/dtos/create-patient.dto';
import { PATIENT_MESSAGES } from 'src/patients/patient.messages';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { Prisma } from '@prisma/client';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { normalizeCpf } from '../cpf';
import { guardianColumns, todayCivilDate } from '../guardian';

@Injectable()
export class CreatePatientUseCase {
  constructor(
    private patientRepository: PatientRepository,
    private prisma: PrismaService,
    private auditLog: IAuditLogService,
  ) {}

  async execute(
    dto: CreatePatientDto,
    currentUser: AuthenticatedUserPayload,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const cpf = normalizeCpf(dto.cpf);
    const birthDate = new Date(dto.birthDate);
    const organization = await client.organization.findUniqueOrThrow({
      where: { id: currentUser.organizationId },
      select: { timeZone: true },
    });
    const guardian = guardianColumns(
      dto.guardian,
      birthDate,
      todayCivilDate(organization.timeZone),
    );

    if (cpf) {
      const holder = await client.patient.findFirst({
        where: { organizationId: currentUser.organizationId, cpf },
        select: { id: true },
      });

      if (holder) {
        throw new ConflictException(PATIENT_MESSAGES.cpfAlreadyRegistered);
      }
    }

    const savedPatient = await this.patientRepository.create(
      {
        fullName: dto.fullName,
        birthDate,
        weightInKg: dto.weightInKg,
        phoneNumber: dto.phoneNumber,
        cpf,
        ...guardian,
        organizationId: currentUser.organizationId,
        responsiblePhysicianId: dto.responsiblePhysicianId,
        createdById: currentUser.id,
        updatedById: currentUser.id,
        isActive: true,
        isArchived: false,
      },
      tx,
    );

    await this.auditLog.record(
      {
        userId: currentUser.id,
        organizationId: currentUser.organizationId,
        entityType: AUDIT_ENTITY_TYPES.PATIENT,
        entityId: savedPatient.id,
        action: AUDIT_ACTIONS.PATIENT_CREATED,
        newValues: { ...savedPatient },
      },
      tx,
    );

    return savedPatient;
  }
}
