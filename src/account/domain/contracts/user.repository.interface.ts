import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { User } from '../entities/user.entity';
import { Prisma } from '@prisma/client';
import { UserCreationData, UserUpdateData } from './interfaces/account.interface';

export abstract class IUserRepository {
  abstract create(
    user: UserCreationData,
    tx?: Prisma.TransactionClient,
  ): Promise<User>;

  abstract update(user: Partial<UserUpdateData>, tx?: Prisma.TransactionClient): Promise<User>;

  abstract findUserByEmail(
    email: string,
    currentUser: AuthenticatedUserPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<User | null>;

  abstract findUserById(
    id: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<User | null>;

  abstract findUserSystemById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<User | null>;

  abstract existsByEmail(
    email: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean>;

  abstract exists(id: string, tx?: Prisma.TransactionClient): Promise<boolean>;

  abstract delete(id: string, tx?: Prisma.TransactionClient): Promise<boolean>;
}

