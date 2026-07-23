import { Professional } from '@prisma/client';
import { ITransactionContext } from 'src/database/transaction.interface';
import {
  CreateProfessionalData,
  UpdateProfessionalData,
} from './professional.interface';

export abstract class ProfessionalRepository {
  abstract create(
    data: CreateProfessionalData,
    tx?: ITransactionContext,
  ): Promise<Professional>;

  abstract findById(
    id: string,
    tx?: ITransactionContext,
  ): Promise<Professional | null>;

  abstract findByUserId(
    userId: string,
    tx?: ITransactionContext,
  ): Promise<Professional | null>;

  abstract update(
    data: UpdateProfessionalData,
    tx?: ITransactionContext,
  ): Promise<Professional>;
}
