import { DoseStatus } from "@prisma/client";

export interface CreateDoseData {
    concentration: string;
    volume: number;
    scheduledAt: Date | null;
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

export interface UpdateDoseData {
    id: string;
    concentration: string;
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