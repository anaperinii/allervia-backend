import { Prisma } from '@prisma/client';
import { UserInvite } from '../entities/user-invite.entity';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { CreateInviteData, FindInvitesFilters, UpdateInviteData } from './interfaces/invite.interface';

export abstract class IUserInviteRepository {
  abstract create(
    invite: CreateInviteData,
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite>;

  abstract update(
    invite: Partial<UpdateInviteData>,
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite>;

  abstract findById(
    id: string,
    currentUser: AuthenticatedUserPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite | null>;

  abstract findByToken(
    token: string,
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite | null>;

  abstract findByOrganization(
    organizationId: string,
    filters?: FindInvitesFilters,
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite[]>;

  abstract findActiveInvite(
    email: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite | null>;

  abstract exists(id: string, tx?: Prisma.TransactionClient): Promise<boolean>;
}
