import { UserCreationData, UserUpdateData } from './account.interface';
import { Prisma } from '@prisma/client';
import { User } from '@prisma/client';

export abstract class IUserRepository {
  abstract create(
    userCreationData: UserCreationData,
    tx?: Prisma.TransactionClient,
  ): Promise<User>;

  abstract update(userUpdateData: Partial<UserUpdateData>): Promise<User>;

  abstract findUserByEmail(email: string): Promise<User | null>;

  abstract findUserById(userId: string): Promise<User | null>;

  abstract existsByEmail(email: string): Promise<boolean>;
}
