import { UserInvite } from 'src/invites/domain/entities/user-invite.entity';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import {
  CreateInviteData,
  FindInvitesFilters,
  InviteContext,
  InviteWithAuthor,
  UpdateInviteData,
} from './invite.interface';
import { Prisma } from '@prisma/client';
import { PageBounds } from 'src/infra/http/pagination';

export abstract class IUserInviteRepository {
  abstract create(
    invite: CreateInviteData,
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite>;

  abstract update(
    invite: Partial<UpdateInviteData>,
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite>;

  abstract markAsUsed(
    id: string,
    usedAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean>;

  abstract findById(
    id: string,
    currentUser: AuthenticatedUserPayload,
  ): Promise<UserInvite | null>;

  abstract findByToken(token: string): Promise<UserInvite | null>;

  abstract findPageByOrganization(
    organizationId: string,
    filters: FindInvitesFilters,
    bounds: PageBounds,
  ): Promise<{ items: InviteWithAuthor[]; total: number }>;

  abstract findContextByToken(token: string): Promise<InviteContext | null>;

  abstract findActiveInvite(
    email: string,
    organizationId: string,
  ): Promise<UserInvite | null>;

  abstract exists(id: string): Promise<boolean>;
}
