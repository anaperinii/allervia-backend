import { Prisma } from '@prisma/client';
import { Patient } from '../entities/patient.entity';
import {
  CreatePatientData,
  UpdatePatientData,
} from './patients.interface';

export abstract class IPatientRepository {
  abstract create(
    patient: CreatePatientData,
    tx?: Prisma.TransactionClient,
  ): Promise<Patient>;

  abstract update(
    patientId: string,
    patient: Partial<UpdatePatientData>,
    tx?: Prisma.TransactionClient,
  ): Promise<Patient>;

  abstract findById(
    id: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Patient | null>;

  abstract findByOrganization(
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Patient[]>;
  
  abstract exists(
    id: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean>;
}
