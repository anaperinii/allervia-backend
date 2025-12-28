import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { User } from '../entities/user.entity';
import { UserCreationData, UserUpdateData } from './account.interface';
import { ITransactionContext } from 'src/database/transaction.interface';

export abstract class IUserRepository {
  abstract create( userCreationData: UserCreationData, tx?: ITransactionContext ): Promise<User>;

  abstract update( userUpdateData: Partial<UserUpdateData>, tx?: ITransactionContext ): Promise<User>;

  abstract findUserByEmail( email: string, currentUser: AuthenticatedUserPayload, tx?: ITransactionContext ): Promise<User | null>;

  abstract findAllUsersByOrg( organizationId: string ): Promise<User[]>;

  abstract findUserById( userId: string, organizationId: string, tx?: ITransactionContext ): Promise<User | null>;

  abstract findUserSystemById( userId: string, tx?: ITransactionContext ): Promise<User | null>;

  abstract existsByEmail( email: string, tx?: ITransactionContext ): Promise<boolean>;
}

