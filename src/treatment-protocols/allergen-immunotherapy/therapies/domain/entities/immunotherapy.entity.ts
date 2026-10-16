import type { ProtocolPrescription, Prisma } from '@prisma/client';
import { AdministrationRoute, TherapyStatus } from '@prisma/client';

export interface ImmunotherapyProps {
  prescription?: ProtocolPrescription | null;
  revision?: number;
  id: string;
  immunoType: string;
  administrationRoute: AdministrationRoute;
  extract: string;
  inductionStartDate: Date;
  maintenanceStartDate: Date | null;
  targetConcentration: number;
  targetVolume: Prisma.Decimal | string;
  patientId: string;
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
  targetVolume: string;
  patientId: string;
  createdById: string;
  updatedById: string;
}

export class Immunotherapy {
  prescription?: ProtocolPrescription | null;
  revision: number;
  id: string;
  immunoType: string;
  administrationRoute: AdministrationRoute;
  extract: string;
  inductionStartDate: Date;
  maintenanceStartDate: Date | null;
  targetConcentration: number;
  targetVolume: string;
  patientId: string;
  isArchived: boolean;
  status: TherapyStatus;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  updatedById: string;
  archivedById: string | null;
  archivedAt: Date | null;

  constructor(props: ImmunotherapyProps) {
    this.prescription = props.prescription;
    this.revision = props.revision ?? 0;
    this.id = props.id;
    this.immunoType = props.immunoType;
    this.administrationRoute = props.administrationRoute;
    this.extract = props.extract;
    this.inductionStartDate = props.inductionStartDate;
    this.maintenanceStartDate = props.maintenanceStartDate;
    this.targetConcentration = props.targetConcentration;
    this.targetVolume = props.targetVolume.toString();
    this.patientId = props.patientId;
    this.createdById = props.createdById;
    this.isArchived = props.isArchived;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.updatedById = props.updatedById;
    this.archivedById = props.archivedById;
    this.archivedAt = props.archivedAt;
  }
}
