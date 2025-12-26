import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { Immunotherapy } from '../../domain/entities/immunotherapy.entity';
import { IImmunotherapyRepository } from '../../domain/contracts/immunotherapy.repository.interface';
import { CreateImmunotherapyData, UpdateImmunotherapyData } from 'src/immunotherapies/domain/contracts/immunotherapy.interfaces';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class PrismaImmunotherapyRepository extends IImmunotherapyRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(immunotherapy: CreateImmunotherapyData, tx?: ITransactionContext): Promise<Immunotherapy> {

    const prismaClient = this.prisma.getClient(tx);

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

  async update(immunoId: string, immunotherapy: Partial<UpdateImmunotherapyData>, tx?: ITransactionContext): Promise<Immunotherapy> {

    const prismaClient = this.prisma.getClient(tx);

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

  async findAll(organizationId: string, tx?: ITransactionContext): Promise<Immunotherapy[]> {
    
    const prismaClient = this.prisma.getClient(tx);

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

  async findById(id: string, organizationId: string, tx?: ITransactionContext): Promise<Immunotherapy | null> {

    const prismaClient = this.prisma.getClient(tx);

    const therapy = await prismaClient.immunotherapy.findFirst({
      where: {
        id,
        patient: { primaryOrganizationId: organizationId },
      },
    });

    return therapy ? new Immunotherapy(therapy) : null;
  }

  async findByPatient(patientId: string, organizationId: string, tx?: ITransactionContext): Promise<Immunotherapy[]> {

    const prismaClient = this.prisma.getClient(tx);

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

  async findByType(type: string, organizationId: string, tx?: ITransactionContext): Promise<Immunotherapy[]> {

    const prismaClient = this.prisma.getClient(tx);

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

  async exists(id: string, organizationId: string, tx?: ITransactionContext): Promise<boolean> {

    const prismaClient = this.prisma.getClient(tx);

    const count = await prismaClient.immunotherapy.count({
      where: {
        id,
        patient: { primaryOrganizationId: organizationId },
      },
    });

    return count > 0;
  }
}

