import { ITransactionContext } from 'src/database/transaction.interface';
import { Patient } from '../entities/patient.entity';
import {
  CreatePatientData,
  UpdatePatientData,
} from './patients.interface';

export abstract class IPatientRepository {
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
