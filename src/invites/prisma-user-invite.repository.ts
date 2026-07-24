import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IUserInviteRepository } from './domain/interfaces/user-invite.repository.interface';
import { UserInvite } from './domain/entities/user-invite.entity';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { FindInvitesFilters, UpdateInviteData } from './domain/interfaces/invite.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaUserInviteRepository extends IUserInviteRepository {
  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async create(invite: UserInvite): Promise<UserInvite> {
    const created = await this.prismaService.internalUserInvite.create({
      data: invite,
    });

    return new UserInvite(created);
  }

  async update(
    invite: Partial<UpdateInviteData>,
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite> {
    const prismaClient = tx ?? this.prismaService;

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
  ): Promise<UserInvite | null> {
    const invite = await this.prismaService.internalUserInvite.findUnique({
      where: { id, organizationId: currentUser.activeOrgId },
    });

    return invite ? new UserInvite(invite) : null;
  }

  async findByToken(token: string): Promise<UserInvite | null> {
    const invite = await this.prismaService.internalUserInvite.findUnique({
      where: { token },
    });

    return invite ? new UserInvite(invite) : null;
  }

  async findByOrganization(
    organizationId: string,
    filters?: FindInvitesFilters,
  ): Promise<UserInvite[]> {
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

    const invites = await this.prismaService.internalUserInvite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return invites.map((i) => new UserInvite(i));
  }

  async findActiveInvite(
    email: string,
    organizationId: string,
  ): Promise<UserInvite | null> {
    const invite = await this.prismaService.internalUserInvite.findFirst({
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
