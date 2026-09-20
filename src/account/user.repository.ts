import { UserCreationData, UserUpdateData } from './account.interface';
import { Prisma, Role } from '@prisma/client';
import { User } from '@prisma/client';
import {
  AccountOrganizationDto,
  AccountProfessionalDto,
  AccountUserDto,
} from './dtos/account-context.dto';

export interface AccountProfileRow {
  user: AccountUserDto;
  professional: AccountProfessionalDto | null;
  organization: AccountOrganizationDto | null;
  roles: Role[];
  hasConfirmedMfa: boolean;
}

export abstract class IUserRepository {
  /** Seleção pública do perfil; nunca devolve senha, tokenVersion ou segredos. */
  abstract findAccountProfile(
    userId: string,
  ): Promise<AccountProfileRow | null>;

  abstract create(
    userCreationData: UserCreationData,
    tx?: Prisma.TransactionClient,
  ): Promise<User>;

  abstract update(
    userUpdateData: Partial<UserUpdateData>,
    tx?: Prisma.TransactionClient,
  ): Promise<User>;

  abstract findUserByEmail(email: string): Promise<User | null>;

  abstract findUserById(userId: string): Promise<User | null>;

  abstract findUserByIdInOrganization(
    userId: string,
    organizationId: string,
  ): Promise<User | null>;

  abstract existsByEmail(email: string): Promise<boolean>;

  abstract changePassword(
    userId: string,
    passwordHash: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}
