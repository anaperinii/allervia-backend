export interface CreatePatientData {
  fullName: string;
  birthDate: Date;
  weightInKg: number;
  phoneNumber: string;
  /** Apenas dígitos; null quando a pessoa não possui CPF conhecido. */
  cpf: string | null;
  organizationId: string;
  responsiblePhysicianId: string;
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
  cpf: string | null;
  responsiblePhysicianId: string;
  updatedById: string;
  isActive: boolean;
  isArchived: boolean;
  archivedById: string | null;
  archivedAt: Date | null;
}
