import { ITransactionContext } from 'src/database/transaction.interface';
import { Immunotherapy } from '../entities/immunotherapy.entity';
import {
  CreateImmunotherapyData,
  UpdateImmunotherapyData,
} from './immunotherapy.interfaces';

export abstract class IImmunotherapyRepository {
  abstract create(
    immunotherapy: CreateImmunotherapyData,
    tx?: ITransactionContext,
  ): Promise<Immunotherapy>;

  abstract update(
    immunoId: string,
    immunotherapy: Partial<UpdateImmunotherapyData>,
    tx?: ITransactionContext,
  ): Promise<Immunotherapy>;

  abstract findById(
    id: string,
    organizationId: string,
    tx?: ITransactionContext,
  ): Promise<Immunotherapy | null>;

  abstract findAll(
    organizationId: string,
    tx?: ITransactionContext,
  ): Promise<Immunotherapy[]>;

  abstract findByPatient(
    patientId: string,
    organizationId: string,
    tx?: ITransactionContext,
  ): Promise<Immunotherapy[]>;

  abstract findByType(
    type: string,
    organizationId: string,
    tx?: ITransactionContext,
  ): Promise<Immunotherapy[]>;

  abstract exists(
    id: string,
    organizationId: string,
    tx?: ITransactionContext,
  ): Promise<boolean>;
}
