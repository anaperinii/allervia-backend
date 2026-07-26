import { UserInvite } from 'src/invites/domain/entities/user-invite.entity';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import {
  CreateInviteData,
  FindInvitesFilters,
  UpdateInviteData,
} from './invite.interface';
import { Prisma } from '@prisma/client';

export abstract class IUserInviteRepository {
  abstract create(invite: CreateInviteData): Promise<UserInvite>;

  abstract update(
    invite: Partial<UpdateInviteData>,
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite>;

  abstract findById(
    id: string,
    currentUser: AuthenticatedUserPayload,
  ): Promise<UserInvite | null>;

  abstract findByToken(token: string): Promise<UserInvite | null>;

  abstract findByOrganization(
    organizationId: string,
    filters?: FindInvitesFilters,
  ): Promise<UserInvite[]>;

  abstract findActiveInvite(
    email: string,
    organizationId: string,
  ): Promise<UserInvite | null>;

  abstract exists(id: string): Promise<boolean>;
}
