import { Professional, Prisma } from '@prisma/client';
import {
  CreateProfessionalData,
  UpdateProfessionalData,
} from './professional.interface';

export abstract class ProfessionalRepository {
  abstract create(
    data: CreateProfessionalData,
    tx?: Prisma.TransactionClient,
  ): Promise<Professional>;

  abstract findById(id: string): Promise<Professional | null>;

  abstract findByUserId(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Professional | null>;

  abstract update(data: UpdateProfessionalData): Promise<Professional>;
}
