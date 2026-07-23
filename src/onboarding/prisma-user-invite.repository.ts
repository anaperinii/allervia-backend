import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { IUserInviteRepository } from './domain/interfaces/user-invite.repository.interface';
import { UserInvite } from './domain/entities/user-invite.entity';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { FindInvitesFilters, UpdateInviteData } from './domain/interfaces/invite.interface';
import { ITransactionContext } from 'src/database/transaction.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaUserInviteRepository extends IUserInviteRepository {
  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async create(
    invite: UserInvite,
    tx?: ITransactionContext,
  ): Promise<UserInvite> {
    const prismaClient = this.prismaService.getClient(tx);

    const created = await prismaClient.internalUserInvite.create({
      data: invite,
    });

    return new UserInvite(created);
  }

  async update(
    invite: Partial<UpdateInviteData>,
    tx?: ITransactionContext,
  ): Promise<UserInvite> {
    const prismaClient = this.prismaService.getClient(tx);

    const updated = await prismaClient.internalUserInvite.update({
      where: { id: invite.id },
      data: {
        professionalId: invite.professionalId,
        expiresAt: invite.expiresAt,
        isActive: invite.isActive,
        usedAt: invite.usedAt,
      },
    });

    return new UserInvite(updated);
  }

  async findById(
    id: string,
    currentUser: AuthenticatedUserPayload,
    tx?: ITransactionContext,
  ): Promise<UserInvite | null> {
    const prismaClient = this.prismaService.getClient(tx);

    const invite = await prismaClient.internalUserInvite.findUnique({
      where: {
        id,
        organizationId: currentUser.activeOrgId,
      },
    });

    return invite ? new UserInvite(invite) : null;
  }

  async findByToken(
    token: string,
    tx?: ITransactionContext,
  ): Promise<UserInvite | null> {
    const prismaClient = this.prismaService.getClient(tx);

    const invite = await prismaClient.internalUserInvite.findUnique({
      where: { token },
    });

    return invite ? new UserInvite(invite) : null;
  }

  async findByOrganization(
    organizationId: string,
    filters?: FindInvitesFilters,
    tx?: ITransactionContext,
  ): Promise<UserInvite[]> {
    const prismaClient = this.prismaService.getClient(tx);

    const where: Prisma.InternalUserInviteWhereInput = { organizationId };

    if (filters?.role) {
      where.role = filters.role;
    }

    if (filters?.onlyActive) {
      where.isActive = true;
    }

    if (!filters?.includeExpired) {
      where.expiresAt = { gte: new Date() };
    }

    const invites = await prismaClient.internalUserInvite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return invites.map((i) => new UserInvite(i));
  }

  async findActiveInvite(
    email: string,
    organizationId: string,
    tx?: ITransactionContext,
  ): Promise<UserInvite | null> {
     const prismaClient = this.prismaService.getClient(tx);

    const invite = await prismaClient.internalUserInvite.findFirst({
      where: {
        email,
        organizationId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });

    return invite ? new UserInvite(invite) : null;
  }

  async exists(id: string): Promise<boolean> {

    const count = await this.prismaService.internalUserInvite.count({
      where: { id },
    });

    return count > 0;
  }
}
