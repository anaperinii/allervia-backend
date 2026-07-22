import { ITransactionContext } from 'src/database/transaction.interface';
import { CreatePatientData, UpdatePatientData } from './patients.interface';
import { Patient } from '@prisma/client';

export abstract class PatientRepository {
  abstract create(
    patient: CreatePatientData,
    tx?: ITransactionContext,
  ): Promise<Patient>;

  abstract update(
    patientId: string,
    patient: Partial<UpdatePatientData>,
    tx?: ITransactionContext,
  ): Promise<Patient>;

  abstract findById(
    id: string,
    organizationId: string,
    tx?: ITransactionContext,
  ): Promise<Patient | null>;

  abstract findByOrganization(
    organizationId: string,
    tx?: ITransactionContext,
  ): Promise<Patient[]>;
  
  abstract exists(
    id: string,
    organizationId: string,
    tx?: ITransactionContext,
  ): Promise<boolean>;
}
