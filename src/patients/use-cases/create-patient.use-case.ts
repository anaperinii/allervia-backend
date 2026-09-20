import { ConflictException, Injectable } from '@nestjs/common';
import { PatientRepository } from 'src/patients/patient.repository';
import { CreatePatientDto } from 'src/patients/dtos/create-patient.dto';
import { PATIENT_MESSAGES } from 'src/patients/patient.messages';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { Prisma } from '@prisma/client';
import { normalizeCpf } from '../cpf';

@Injectable()
export class CreatePatientUseCase {
  constructor(
    private patientRepository: PatientRepository,
    private prisma: PrismaService,
  ) {}

  async execute(
    dto: CreatePatientDto,
    currentUser: AuthenticatedUserPayload,
    tx?: Prisma.TransactionClient,
  ) {
    const cpf = normalizeCpf(dto.cpf);

    if (cpf) {
      const client = tx ?? this.prisma;
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
        birthDate: dto.birthDate,
        weightInKg: dto.weightInKg,
        phoneNumber: dto.phoneNumber,
        cpf,
        organizationId: currentUser.organizationId,
        responsiblePhysicianId: dto.responsiblePhysicianId,
        createdById: currentUser.id,
        updatedById: currentUser.id,
        isActive: true,
        isArchived: false,
      },
      tx,
    );

    return savedPatient;
  }
}
