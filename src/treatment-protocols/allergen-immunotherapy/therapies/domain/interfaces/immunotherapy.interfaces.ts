import { AdministrationRoute, TherapyStatus } from "@prisma/client";

export interface CreateImmunotherapyData {
    immunoType: string;
    administrationRoute: AdministrationRoute;
    extract: string;
    inductionStartDate: Date;
    targetConcentration: number;
    targetVolume: number;
    patientId: string;
    responsiblePhysicianId: string;
    status: TherapyStatus;
    createdById: string;
    updatedById: string;
    isArchived: boolean;
}

export interface UpdateImmunotherapyData {
    administrationRoute: AdministrationRoute;
    extract: string;
    inductionStartDate: Date;
    maintenanceStartDate: Date | null;
    targetConcentration: number;
    targetVolume: number;
    responsiblePhysicianId: string;
    isArchived: boolean;
    status: TherapyStatus;
    updatedById: string;
    archivedById: string | null;
    archivedAt: Date | null;    
}