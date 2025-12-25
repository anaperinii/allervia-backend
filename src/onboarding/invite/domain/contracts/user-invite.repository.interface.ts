import { UserInvite } from '../entities/user-invite.entity';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { CreateInviteData, FindInvitesFilters, UpdateInviteData } from './interfaces/invite.interface';
import { ITransactionContext } from 'src/database/transaction.interface';

export abstract class IUserInviteRepository {
  abstract create(
    invite: CreateInviteData,
    tx?: ITransactionContext,
  ): Promise<UserInvite>;

  abstract update(
    invite: Partial<UpdateInviteData>,
    tx?: ITransactionContext,
  ): Promise<UserInvite>;

  abstract findById(
    id: string,
    currentUser: AuthenticatedUserPayload,
    tx?: ITransactionContext,
  ): Promise<UserInvite | null>;

  abstract findByToken(
    token: string,
    tx?: ITransactionContext,
  ): Promise<UserInvite | null>;

  abstract findByOrganization(
    organizationId: string,
    filters?: FindInvitesFilters,
    tx?: ITransactionContext,
  ): Promise<UserInvite[]>;

  abstract findActiveInvite(
    email: string,
    organizationId: string,
    tx?: ITransactionContext,
  ): Promise<UserInvite | null>;

  abstract exists(id: string): Promise<boolean>;
}
