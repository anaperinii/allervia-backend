import { BadRequestException } from '@nestjs/common';
import { AdministrationRoute, TherapyStatus } from '@prisma/client';

export interface ImmunotherapyProps {
  id: string;
  immunoType: string;
  administrationRoute: AdministrationRoute;
  extract: string;
  inductionStartDate: Date;
  maintenanceStartDate: Date | null;
  targetConcentration: number;
  targetVolume: number;
  patientId: string;
  responsiblePhysicianId: string;
  createdById: string;
  isArchived: boolean;
  status: TherapyStatus;
  createdAt: Date;
  updatedAt: Date;
  updatedById: string;
  archivedById: string | null;
  archivedAt: Date | null;
}

export interface CreateImmunotherapyProps {
  immunoType: string;
  administrationRoute: AdministrationRoute;
  extract: string;
  inductionStartDate: Date;
  targetConcentration: number;
  targetVolume: number;
  patientId: string;
  responsiblePhysicianId: string;
  createdById: string;
  updatedById: string;
}

export class Immunotherapy {
  id: string;
  immunoType: string;
  administrationRoute: AdministrationRoute;
  extract: string;
  inductionStartDate: Date;
  maintenanceStartDate: Date | null;
  targetConcentration: number;
  targetVolume: number;
  patientId: string;
  responsiblePhysicianId: string;
  isArchived: boolean;
  status: TherapyStatus;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  updatedById: string;
  archivedById: string | null;
  archivedAt: Date | null;

  constructor(props: ImmunotherapyProps) {
    this.id = props.id;
    this.immunoType = props.immunoType;
    this.administrationRoute = props.administrationRoute;
    this.extract = props.extract;
    this.inductionStartDate = props.inductionStartDate;
    this.maintenanceStartDate = props.maintenanceStartDate;
    this.targetConcentration = props.targetConcentration;
    this.targetVolume = props.targetVolume;
    this.patientId = props.patientId;
    this.responsiblePhysicianId = props.responsiblePhysicianId;
    this.createdById = props.createdById;
    this.isArchived = props.isArchived;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.updatedById = props.updatedById;
    this.archivedById = props.archivedById;
    this.archivedAt = props.archivedAt;
  }

  static createNew(props: CreateImmunotherapyProps) {
    return {
      immunoType: props.immunoType.trim(),
      administrationRoute: props.administrationRoute,
      extract: props.extract,
      inductionStartDate: props.inductionStartDate,
      targetConcentration: props.targetConcentration,
      targetVolume: props.targetVolume,
      patientId: props.patientId,
      responsiblePhysicianId: props.responsiblePhysicianId,
      status: TherapyStatus.IN_PROGRESS,
      createdById: props.createdById,
      updatedById: props.updatedById,
      isArchived: false,
    };
  }

  updateStatus(status: TherapyStatus, updatedById: string): void {
    if (this.status === status) {
      throw new BadRequestException(
        `A respectiva imunoterapia já possui o status ${this.status}`,
      );
    }
    this.status = status;
    this.updatedById = updatedById;
  }

  archive(archivedById: string): void {
    if (this.isArchived) {
      throw new Error('Cannot archive an already archived immunotherapy');
    }

    this.isArchived = true;
    this.archivedById = archivedById;
    this.archivedAt = new Date();
  }
}
