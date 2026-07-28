import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { PatientRepository } from './patient.repository';
import {
  CreatePatientData,
  UpdatePatientData,
} from 'src/patients/patients.interface';
import { Prisma } from '@prisma/client';
import { Patient } from '@prisma/client';

@Injectable()
export class PrismaPatientRepository extends PatientRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(
    patient: CreatePatientData,
    tx?: Prisma.TransactionClient,
  ): Promise<Patient> {
    const prismaClient = tx ?? this.prisma;

    return prismaClient.patient.create({
      data: {
        fullName: patient.fullName,
        birthDate: patient.birthDate,
        weightInKg: patient.weightInKg,
        phoneNumber: patient.phoneNumber,
        organizationId: patient.organizationId,
        responsiblePhysicianId: patient.responsiblePhysicianId,
        isActive: patient.isActive,
        isArchived: patient.isArchived,
        createdById: patient.createdById,
        updatedById: patient.updatedById,
      },
    });
  }

  async update(
    patientId: string,
    patient: Partial<UpdatePatientData>,
  ): Promise<Patient> {
    return this.prisma.patient.update({
      where: { id: patientId },
      data: {
        fullName: patient.fullName,
        birthDate: patient.birthDate,
        weightInKg: patient.weightInKg,
        phoneNumber: patient.phoneNumber,
        userId: patient.userId,
        isActive: patient.isActive,
        isArchived: patient.isArchived,
        updatedById: patient.updatedById,
        archivedById: patient.archivedById,
        archivedAt: patient.archivedAt,
      },
    });
  }

  async findById(id: string, organizationId: string): Promise<Patient | null> {
    return this.prisma.patient.findFirst({
      where: { id, organizationId },
    });
  }

  async findAccessible(where: Prisma.PatientWhereInput): Promise<Patient[]> {
    return this.prisma.patient.findMany({
      where: { AND: [where, { isArchived: false }] },
      orderBy: { fullName: 'asc' },
    });
  }

  async findByIdAccessible(
    id: string,
    where: Prisma.PatientWhereInput,
  ): Promise<Patient | null> {
    return this.prisma.patient.findFirst({
      where: { AND: [{ id }, where] },
    });
  }

  async exists(id: string, organizationId: string): Promise<boolean> {
    const count = await this.prisma.patient.count({
      where: { id, organizationId },
    });

    return count > 0;
  }
}
