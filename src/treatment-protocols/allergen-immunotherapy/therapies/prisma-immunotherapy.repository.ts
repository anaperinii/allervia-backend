import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { Immunotherapy } from './domain/entities/immunotherapy.entity';
import { IImmunotherapyRepository } from './domain/interfaces/immunotherapy.repository.interface';
import { CreateImmunotherapyData, UpdateImmunotherapyData } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.interfaces';
import { Prisma } from '@prisma/client';

const IMMUNO_INCLUDE = {
  patient: true,
  responsiblePhysician: true,
  createdBy: { select: { id: true } },
  updatedBy: { select: { id: true } },
};

@Injectable()
export class PrismaImmunotherapyRepository extends IImmunotherapyRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(immunotherapy: CreateImmunotherapyData, tx?: Prisma.TransactionClient): Promise<Immunotherapy> {
    const prismaClient = tx ?? this.prisma;

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
        updatedById: immunotherapy.updatedById,
      },
    });

    return new Immunotherapy(created);
  }

  async update(immunoId: string, immunotherapy: Partial<UpdateImmunotherapyData>): Promise<Immunotherapy> {
    const updated = await this.prisma.immunotherapy.update({
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

  async findAll(organizationId: string): Promise<Immunotherapy[]> {
    const immunotherapies = await this.prisma.immunotherapy.findMany({
      where: { patient: { organizationId } },
      include: IMMUNO_INCLUDE,
    });

    return immunotherapies.map((t) => new Immunotherapy(t));
  }

  async findById(id: string, organizationId: string): Promise<Immunotherapy | null> {
    const therapy = await this.prisma.immunotherapy.findFirst({
      where: { id, patient: { organizationId } },
    });

    return therapy ? new Immunotherapy(therapy) : null;
  }

  async findByPatient(patientId: string, organizationId: string): Promise<Immunotherapy[]> {
    const therapies = await this.prisma.immunotherapy.findMany({
      where: { patientId, patient: { organizationId } },
      orderBy: { createdAt: 'desc' },
      include: IMMUNO_INCLUDE,
    });

    return therapies.map((t) => new Immunotherapy(t));
  }

  async findByType(type: string, organizationId: string): Promise<Immunotherapy[]> {
    const therapies = await this.prisma.immunotherapy.findMany({
      where: { immunoType: type, patient: { organizationId } },
      include: IMMUNO_INCLUDE,
    });

    return therapies.map((t) => new Immunotherapy(t));
  }

  async exists(id: string, organizationId: string): Promise<boolean> {
    const count = await this.prisma.immunotherapy.count({
      where: { id, patient: { organizationId } },
    });

    return count > 0;
  }
}
