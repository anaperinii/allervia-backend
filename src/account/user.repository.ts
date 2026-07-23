import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { UserCreationData, UserUpdateData } from './account.interface';
import { ITransactionContext } from 'src/database/transaction.interface';
import { User } from '@prisma/client';

export abstract class IUserRepository {
  abstract create( userCreationData: UserCreationData, tx?: ITransactionContext ): Promise<User>;

  abstract update( userUpdateData: Partial<UserUpdateData>, tx?: ITransactionContext ): Promise<User>;

  abstract findUserByEmail( email: string, currentUser: AuthenticatedUserPayload, tx?: ITransactionContext ): Promise<User | null>;

  abstract findUserById( userId: string, organizationId: string, tx?: ITransactionContext ): Promise<User | null>;

  abstract existsByEmail( email: string, tx?: ITransactionContext ): Promise<boolean>;
}

