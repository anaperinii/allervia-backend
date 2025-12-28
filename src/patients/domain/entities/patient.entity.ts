import { PatientAlreadyArchivedException } from '../exceptions/patient-already-archived.exception';

export interface PatientProps {
  id: string;
  fullName: string;
  birthDate: Date;
  weightInKg: number;
  phoneNumber: string;
  primaryOrganizationId: string;
  userId: string | null;
  isActive: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  updatedById: string;
  archivedById: string | null;
  archivedAt: Date | null;
}

export interface CreatePatientProps {
  fullName: string;
  birthDate: Date;
  weightInKg: number;
  phoneNumber: string;
  primaryOrganizationId: string;
  createdById: string;
  updatedById: string;
}

export class Patient {
  id: string;
  fullName: string;
  birthDate: Date;
  weightInKg: number;
  phoneNumber: string;
  primaryOrganizationId: string;
  userId: string | null;
  isActive: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  updatedById: string;
  archivedById: string | null;
  archivedAt: Date | null;

  constructor(props: PatientProps) {
    this.id = props.id;
    this.fullName = props.fullName;
    this.birthDate = props.birthDate;
    this.weightInKg = props.weightInKg;
    this.phoneNumber = props.phoneNumber;
    this.primaryOrganizationId = props.primaryOrganizationId;
    this.userId = props.userId;
    this.isActive = props.isActive;
    this.isArchived = props.isArchived;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdById = props.createdById;
    this.updatedById = props.updatedById;
    this.archivedById = props.archivedById;
    this.archivedAt = props.archivedAt;
  }

  static createNew(props: CreatePatientProps) {
    return {
      fullName: props.fullName.trim(),
      birthDate: props.birthDate,
      weightInKg: props.weightInKg,
      phoneNumber: props.phoneNumber.trim(),
      primaryOrganizationId: props.primaryOrganizationId,
      createdById: props.createdById,
      updatedById: props.updatedById,
      isActive: true,
      isArchived: false
    }
  }

  activate(): void {
    if (this.isActive) {
      throw new Error('Cannot activate an already active patient'); 
    }

    this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
  }

  archive(archivedById: string): void {
    if (this.isArchived) {
      throw new PatientAlreadyArchivedException();
    }

    this.isArchived = true;
    this.isActive = false;
    this.archivedById = archivedById;
    this.archivedAt = new Date();
  }

  unarchive(): void {
    this.isArchived = false
  }
}