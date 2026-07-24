export interface CreatePatientData {
  fullName: string;
  birthDate: Date;
  weightInKg: number;
  phoneNumber: string;
  organizationId: string;
  createdById: string;
  updatedById: string;
  isActive: boolean;
  isArchived: boolean;
}

export interface UpdatePatientData {
  id: string;
  fullName: string;
  birthDate: Date;
  weightInKg: number;
  userId: string | null;
  phoneNumber: string;
  updatedById: string;
  isActive: boolean;
  isArchived: boolean;
  archivedById: string | null;
  archivedAt: Date | null;
}
