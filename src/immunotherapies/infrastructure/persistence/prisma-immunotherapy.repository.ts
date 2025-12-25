import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { Immunotherapy } from '../../domain/entities/immunotherapy.entity';
import { IImmunotherapyRepository } from '../../domain/contracts/immunotherapy.repository.interface';
import { CreateImmunotherapyData, UpdateImmunotherapyData } from 'src/immunotherapies/domain/contracts/interfaces/immunotherapy.interfaces';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaImmunotherapyRepository extends IImmunotherapyRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(immunotherapy: CreateImmunotherapyData, tx?: Prisma.TransactionClient): Promise<Immunotherapy> {

    const prismaClient = tx || this.prisma;

    const created = await prismaClient.immunotherapy.create({
      data: {
        immunoType: immunotherapy.immunoType,
        administrationRoute: immunotherapy.administrationRoute,
        extract: immunotherapy.extract,
        inductionStartDate: immunotherapy.inductionStartDate,
        targetConcentration: immunotherapy.targetConcentration,
        targetVolume: immunotherapy.targetVolume,
        patientId: immunotherapy.patientId,
        responsiblePhysicianId: immunotherapy.responsiblePhysicianId,
        isArchived: immunotherapy.isArchived,
        status: immunotherapy.status,
        createdById: immunotherapy.createdById,
        updatedById: immunotherapy.updatedById
      },
    });

    return new Immunotherapy(created);
  }

  async update(immunoId: string, immunotherapy: Partial<UpdateImmunotherapyData>, tx?: Prisma.TransactionClient): Promise<Immunotherapy> {

    const prismaClient = tx || this.prisma;

    const updated = await prismaClient.immunotherapy.update({
      where: { id: immunoId },
      data: {
        administrationRoute: immunotherapy.administrationRoute,
        extract: immunotherapy.extract,
        inductionStartDate: immunotherapy.inductionStartDate ? new Date(immunotherapy.inductionStartDate) : undefined,
        maintenanceStartDate: immunotherapy.maintenanceStartDate ? new Date(immunotherapy.maintenanceStartDate) : undefined,
        targetConcentration: immunotherapy.targetConcentration,
        targetVolume: immunotherapy.targetVolume,
        responsiblePhysicianId: immunotherapy.responsiblePhysicianId,
        isArchived: immunotherapy.isArchived,
        status: immunotherapy.status,
        updatedById: immunotherapy.updatedById,
        archivedById: immunotherapy.archivedById,
        archivedAt: immunotherapy.archivedAt,
      },
    });

    return new Immunotherapy(updated);
  }

  async findAll(organizationId: string, tx?: Prisma.TransactionClient): Promise<Immunotherapy[]> {
    
    const prismaClient = tx || this.prisma;

    const immunotherapies = await prismaClient.immunotherapy.findMany({
      where: {
        patient: {
          primaryOrganizationId: organizationId
        }
      },
      include: {
        patient: true,
        responsiblePhysician: true,
        createdBy : {
          select: { id: true, fullName: true }
        },
        updatedBy: {
          select: { id: true, fullName: true }
        }
      }
    });

    return immunotherapies.map(t => new Immunotherapy(t)); 
  }

  async findById(id: string, organizationId: string, tx?: Prisma.TransactionClient): Promise<Immunotherapy | null> {

    const prismaClient = tx || this.prisma;

    const therapy = await prismaClient.immunotherapy.findFirst({
      where: {
        id,
        patient: { primaryOrganizationId: organizationId },
      },
    });

    return therapy ? new Immunotherapy(therapy) : null;
  }

  async findByPatient(patientId: string, organizationId: string, tx?: Prisma.TransactionClient): Promise<Immunotherapy[]> {

    const prismaClient = tx || this.prisma;

    const therapies = await prismaClient.immunotherapy.findMany({
      where: {
        patientId,
        patient: { primaryOrganizationId: organizationId },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
        responsiblePhysician: true,
        createdBy : {
          select: { id: true, fullName: true }
        },
        updatedBy: {
          select: { id: true, fullName: true }
        }
      }
    });

    return therapies.map(t => new Immunotherapy(t));
  }

  async findByType(type: string, organizationId: string, tx?: Prisma.TransactionClient): Promise<Immunotherapy[]> {

    const prismaClient = tx || this.prisma;

    const therapies = await prismaClient.immunotherapy.findMany({
      where: {
        immunoType: type,
        patient: { primaryOrganizationId: organizationId },
      },
      include: {
        patient: true,
        responsiblePhysician: true,
        createdBy : {
          select: { id: true, fullName: true }
        },
        updatedBy: {
          select: { id: true, fullName: true }
        }
      }
    });

    return therapies.map(t => new Immunotherapy(t));
  }

  async exists(id: string, organizationId: string, tx?: Prisma.TransactionClient): Promise<boolean> {

    const prismaClient = tx || this.prisma;

    const count = await prismaClient.immunotherapy.count({
      where: {
        id,
        patient: { primaryOrganizationId: organizationId },
      },
    });

    return count > 0;
  }
}

