import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { Dose } from '../../domain/entities/dose.entity';
import { IDoseRepository } from '../../domain/contracts/dose.repository.interface';
import { CreateDoseData, UpdateDoseData } from 'src/doses/domain/contracts/doses.interface';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class PrismaDoseRepository extends IDoseRepository {
  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async create(dose: CreateDoseData, tx?: ITransactionContext): Promise<Dose> {
    const prismaClient = this.prismaService.getClient(tx);
    
    const created = await prismaClient.dose.create({
      data: {
        immunotherapyId: dose.immunotherapyId,
        concentration: dose.concentration,
        volume: dose.volume,
        scheduledAt: dose.scheduledAt ? new Date(dose.scheduledAt) : dose.scheduledAt,
        administeredAt: dose.administeredAt,
        nextIntervalInDays: dose.nextIntervalInDays,
        sideEffect: dose.sideEffect,
        medicationRequired: dose.medicationRequired,
        notes: dose.notes,
        status: dose.status,
        administeredById: dose.administeredById,
        isArchived: dose.isArchived,
        updatedById: dose.updatedById,
        createdById: dose.createdById
      }
    });

    return new Dose(created);
  }

  async update(doseId: string, dose: Partial<UpdateDoseData>): Promise<Dose> {
    const updated = await this.prismaService.dose.update({
      where: { id: doseId },
      data: {
        concentration: dose.concentration,
        volume: dose.volume,
        scheduledAt: dose.scheduledAt ? new Date(dose.scheduledAt) : undefined,
        administeredAt: dose.administeredAt ? new Date(dose.administeredAt) : undefined,
        nextIntervalInDays: dose.nextIntervalInDays,
        sideEffect: dose.sideEffect,
        medicationRequired: dose.medicationRequired,
        notes: dose.notes,
        status: dose.status,
        administeredById: dose.administeredById,
        isArchived: dose.isArchived,
        updatedById: dose.updatedById,
        archivedById: dose.archivedById,
        archivedAt: dose.archivedAt
      }
    });

    return new Dose(updated);
  }

  async findById(id: string, orgId: string): Promise<Dose | null> {
    const dose = await this.prismaService.dose.findUnique({
      where: { 
        id,
        immunotherapy: {
          patient: {
            primaryOrganizationId: orgId
          }
        }
      },
    });

    return dose ? new Dose(dose) : null;
  }

  async findByImmunotherapy(immunotherapyId: string, orgId: string): Promise<Dose[]> {
    const doses = await this.prismaService.dose.findMany({
      where: { 
        immunotherapyId,
        createdBy: {
          organizationId: orgId
        }
       },
      orderBy: { administeredAt: 'desc' },
    });

    return doses.map(dose => new Dose(dose));
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prismaService.dose.count({
      where: { id },
    });

    return count > 0;
  }

  async countDosesByConcentration(concentration: number, immunotherapyId: string, orgId: string): Promise<number> {
    const count = await this.prismaService.dose.count({
      where: {
        concentration,
        immunotherapyId,
        createdBy: {
          organizationId: orgId
        }
      }
    });

    return count;
  }

  async countDosesByInterval(interval: number, immunotherapyId: string, orgId: string): Promise<number> {
    const count = await this.prismaService.dose.count({
      where: {
        nextIntervalInDays: interval,
        immunotherapyId,
        createdBy: {
          organizationId: orgId
        }
      }
    });

    return count;
  }
}


