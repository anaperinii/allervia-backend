export class PatientResponseDto {
  id: string;
  fullName: string;
  birthDate: Date;
  weightInKg: number;
  phoneNumber: string;
  primaryOrganizationId: string;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isArchived: boolean;
  createdById: string;
  updatedById: string | null;
  archivedById: string | null;
  archivedAt: Date | null;
}


