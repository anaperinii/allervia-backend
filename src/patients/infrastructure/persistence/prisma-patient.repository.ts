import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { Patient } from '../../domain/entities/patient.entity';
import { IPatientRepository } from '../../domain/interfaces/patient.repository.interface';
import { CreatePatientData, UpdatePatientData } from 'src/patients/domain/interfaces/patients.interface';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class PrismaPatientRepository extends IPatientRepository {
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
        primaryOrganizationId: patient.primaryOrganizationId,
        isActive: patient.isActive,
        isArchived: patient.isArchived,
        createdById: patient.createdById,
        updatedById: patient.updatedById
      },
    });

    return new Patient(created);
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

    return new Patient(updated);
  }

  async findById(id: string, organizationId: string, tx?: ITransactionContext): Promise<Patient | null> {

    const prismaClient = this.prisma.getClient(tx);

    const patient = await prismaClient.patient.findFirst({
      where: {
        id,
        primaryOrganizationId: organizationId,
      },
    });

    return patient ? new Patient(patient) : null;
  }

  async findByOrganization(organizationId: string, tx?: ITransactionContext): Promise<Patient[]> {

    const prismaClient = this.prisma.getClient(tx);

    const patients = await prismaClient.patient.findMany({
      where: {
        primaryOrganizationId: organizationId,
        isArchived: false,
      },
      orderBy: { fullName: 'asc' },
    });

    return patients.map(p => new Patient(p));
  }

  async exists(id: string, organizationId: string, tx?: ITransactionContext): Promise<boolean> {

    const prismaClient = this.prisma.getClient(tx);

    const count = await prismaClient.patient.count({
      where: {
        id,
        primaryOrganizationId: organizationId,
      },
    });

    return count > 0;
  }
}

