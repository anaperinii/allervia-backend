import { DoseStatus, Prisma } from '@prisma/client';

export interface DoseProps {
  timeZone?: string | null;
  revision?: number;
  prescriptionId?: string | null;
  plannedStepId?: string | null;
  administeredStepId?: string | null;
  plannedValues?: Prisma.JsonValue;
  administeredValues?: Prisma.JsonValue;
  recommendation?: Prisma.JsonValue;
  id: string;
  concentration: number;
  volume: Prisma.Decimal | string;
  scheduledAt: Date;
  administeredAt: Date | null;
  nextIntervalInDays: number;
  betweenDosesReport: string;
  status: DoseStatus;
  isArchived: boolean;
  immunotherapyId: string;
  administeredById: string | null;
  createdById: string;
  updatedById: string;
  archivedById: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDoseProps {
  concentration: number;
  volume: string;
  scheduledAt: Date;
  administeredAt?: Date | null;
  nextIntervalInDays: number;
  betweenDosesReport?: string;
  immunotherapyId: string;
  administeredById?: string | null;
  createdById: string;
  updatedById: string;
}

export class Dose {
  timeZone?: string | null;
  revision: number;
  prescriptionId?: string | null;
  plannedStepId?: string | null;
  administeredStepId?: string | null;
  plannedValues?: Prisma.JsonValue;
  administeredValues?: Prisma.JsonValue;
  recommendation?: Prisma.JsonValue;
  id: string;
  concentration: number;
  volume: string;
  scheduledAt: Date;
  administeredAt: Date | null;
  nextIntervalInDays: number;
  betweenDosesReport: string;
  status: DoseStatus;
  isArchived: boolean;
  immunotherapyId: string;
  administeredById: string | null;
  createdById: string;
  updatedById: string;
  archivedById: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: DoseProps) {
    this.timeZone = props.timeZone ?? null;
    this.revision = props.revision ?? 0;
    this.prescriptionId = props.prescriptionId;
    this.plannedStepId = props.plannedStepId;
    this.administeredStepId = props.administeredStepId;
    this.plannedValues = props.plannedValues;
    this.administeredValues = props.administeredValues;
    this.recommendation = props.recommendation;
    this.id = props.id;
    this.concentration = props.concentration;
    this.volume = props.volume.toString();
    this.scheduledAt = props.scheduledAt;
    this.administeredAt = props.administeredAt;
    this.nextIntervalInDays = props.nextIntervalInDays;
    this.betweenDosesReport = props.betweenDosesReport;
    this.status = props.status;
    this.isArchived = props.isArchived;
    this.immunotherapyId = props.immunotherapyId;
    this.administeredById = props.administeredById;
    this.createdById = props.createdById;
    this.updatedById = props.updatedById;
    this.archivedById = props.archivedById;
    this.archivedAt = props.archivedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
