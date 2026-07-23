import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { PatientRepository } from './patient.repository';
import { CreatePatientData, UpdatePatientData } from 'src/patients/patients.interface';
import { ITransactionContext } from 'src/database/transaction.interface';
import { Patient } from '@prisma/client';

@Injectable()
export class PrismaPatientRepository extends PatientRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(patient: CreatePatientData, tx?: ITransactionContext): Promise<Patient> {

    const prismaClient = this.prisma.getClient(tx);

    const created = await prismaClient.patient.create({
      data: {
        fullName: patient.fullName,
        birthDate: patient.birthDate,
        weightInKg: patient.weightInKg,
        phoneNumber: patient.phoneNumber,
        organizationId: patient.organizationId,
        isActive: patient.isActive,
        isArchived: patient.isArchived,
        createdById: patient.createdById,
        updatedById: patient.updatedById
      },
    });

    return created;
  }

  async update(patientId: string, patient: Partial<UpdatePatientData>, tx?: ITransactionContext): Promise<Patient> {

    const prismaClient = this.prisma.getClient(tx);

    const updated = await prismaClient.patient.update({
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

    return updated;
  }

  async findById(id: string, organizationId: string, tx?: ITransactionContext): Promise<Patient | null> {

    const prismaClient = this.prisma.getClient(tx);

    const patient = await prismaClient.patient.findFirst({
      where: {
        id,
        organizationId: organizationId,
      },
    });

    return patient;
  }

  async findByOrganization(organizationId: string, tx?: ITransactionContext): Promise<Patient[]> {

    const prismaClient = this.prisma.getClient(tx);

    const patients = await prismaClient.patient.findMany({
      where: {
        organizationId: organizationId,
        isArchived: false,
      },
      orderBy: { fullName: 'asc' },
    });

    return patients;
  }

  async exists(id: string, organizationId: string, tx?: ITransactionContext): Promise<boolean> {

    const prismaClient = this.prisma.getClient(tx);

    const count = await prismaClient.patient.count({
      where: {
        id,
        organizationId: organizationId,
      },
    });

    return count > 0;
  }
}

