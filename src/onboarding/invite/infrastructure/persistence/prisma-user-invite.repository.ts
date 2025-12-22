import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { IUserInviteRepository } from '../../domain/contracts/user-invite.repository.interface';
import { UserInvite } from '../../domain/entities/user-invite.entity';
import { Prisma } from '@prisma/client';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { FindInvitesFilters, UpdateInviteData } from '../../domain/contracts/interfaces/invite.interface';

@Injectable()
export class PrismaUserInviteRepository extends IUserInviteRepository {
  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async create(
    invite: UserInvite,
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite> {
    const prismaClient = tx || this.prismaService;

    const created = await prismaClient.internalUserInvite.create({
      data: invite,
    });

    return new UserInvite(created);
  }

  async update(
    invite: Partial<UpdateInviteData>,
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite> {
    const prismaClient = tx || this.prismaService;

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
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite | null> {
    const prismaClient = tx || this.prismaService;

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
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite | null> {
    const prismaClient = tx || this.prismaService;

    const invite = await prismaClient.internalUserInvite.findUnique({
      where: { token },
    });

    return invite ? new UserInvite(invite) : null;
  }

  async findByOrganization(
    organizationId: string,
    filters?: FindInvitesFilters,
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite[]> {
    const prismaClient = tx || this.prismaService;

    const where: Prisma.InternalUserInviteWhereInput = { organizationId };

    if (filters?.roleType) {
      where.roleType = filters.roleType;
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
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite | null> {
    const prismaClient = tx || this.prismaService;

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

  async exists(id: string, tx?: Prisma.TransactionClient): Promise<boolean> {
    const prismaClient = tx || this.prismaService;

    const count = await prismaClient.internalUserInvite.count({
      where: { id },
    });

    return count > 0;
  }
}
