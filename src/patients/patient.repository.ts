import { Prisma } from '@prisma/client';
import { CreatePatientData, UpdatePatientData } from './patients.interface';
import { Patient } from '@prisma/client';

export abstract class PatientRepository {
  abstract create(
    patient: CreatePatientData,
    tx?: Prisma.TransactionClient,
  ): Promise<Patient>;

  abstract update(
    patientId: string,
    patient: Partial<UpdatePatientData>,
  ): Promise<Patient>;

  abstract findById(
    id: string,
    organizationId: string,
  ): Promise<Patient | null>;

  abstract findByOrganization(organizationId: string): Promise<Patient[]>;

  abstract exists(id: string, organizationId: string): Promise<boolean>;
}
