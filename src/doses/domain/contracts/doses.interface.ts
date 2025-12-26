import { DoseStatus } from "@prisma/client";

export interface CreateDoseData {
    concentration: number;
    volume: number;
    scheduledAt: Date;
    administeredAt: Date | null;
    nextIntervalInDays: number;
    sideEffect: string | null;
    medicationRequired: string | null;
    notes: string | null;
    status: DoseStatus;
    immunotherapyId: string;
    administeredById: string | null;
    createdById: string;
    updatedById: string;
    isArchived: boolean;
}

export interface CreateScheduledDoseData {
    concentration: number;
    volume: number;
    scheduledAt: Date;
    nextIntervalInDays: number;
    immunotherapyId: string;
}

export interface UpdateDoseData {
    id: string;
    concentration: number;
    volume: number;
    scheduledAt: Date | null;
    administeredAt: Date | null;
    nextIntervalInDays: number;
    sideEffect: string | null;
    medicationRequired: string | null;
    notes: string | null;
    status: DoseStatus;
    isArchived: boolean;
    administeredById: string | null;
    updatedById: string;
    archivedById: string | null;
    archivedAt: Date | null;
}