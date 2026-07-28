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

  abstract findAccessible(where: Prisma.PatientWhereInput): Promise<Patient[]>;

  abstract findByIdAccessible(
    id: string,
    where: Prisma.PatientWhereInput,
  ): Promise<Patient | null>;

  abstract exists(id: string, organizationId: string): Promise<boolean>;
}
