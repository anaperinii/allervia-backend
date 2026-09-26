import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IUserInviteRepository } from './domain/interfaces/user-invite.repository.interface';
import { UserInvite } from './domain/entities/user-invite.entity';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import {
  FindInvitesFilters,
  InviteContext,
  InviteWithAuthor,
  UpdateInviteData,
} from './domain/interfaces/invite.interface';
import { Prisma } from '@prisma/client';
import { PageBounds } from 'src/infra/http/pagination';

@Injectable()
export class PrismaUserInviteRepository extends IUserInviteRepository {
  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async create(
    invite: UserInvite,
    tx?: Prisma.TransactionClient,
  ): Promise<UserInvite> {
    const prismaClient = tx ?? this.prismaService;

    const created = await prismaClient.internalUserInvite.create({
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
      where: { id, organizationId: currentUser.organizationId },
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

  async findPageByOrganization(
    organizationId: string,
    filters: FindInvitesFilters,
    bounds: PageBounds,
  ): Promise<{ items: InviteWithAuthor[]; total: number }> {
    const where = this.buildWhere(organizationId, filters);

    const [rows, total] = await this.prismaService.$transaction([
      this.prismaService.internalUserInvite.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: bounds.skip,
        take: bounds.take,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          expiresAt: true,
          isActive: true,
          usedAt: true,
          createdAt: true,
          createdBy: { select: { id: true, email: true } },
        },
      }),
      this.prismaService.internalUserInvite.count({ where }),
    ]);

    return { items: rows, total };
  }

  async findContextByToken(token: string): Promise<InviteContext | null> {
    const invite = await this.prismaService.internalUserInvite.findUnique({
      where: { token },
      select: {
        email: true,
        fullName: true,
        role: true,
        expiresAt: true,
        organization: { select: { name: true } },
      },
    });

    if (!invite) return null;

    return {
      email: invite.email,
      fullName: invite.fullName,
      role: invite.role,
      expiresAt: invite.expiresAt,
      organizationName: invite.organization.name,
    };
  }

  private buildWhere(
    organizationId: string,
    filters: FindInvitesFilters,
  ): Prisma.InternalUserInviteWhereInput {
    const where: Prisma.InternalUserInviteWhereInput = { organizationId };

    if (filters.role) where.role = filters.role;
    if (filters.onlyActive) where.isActive = true;
    if (!filters.includeExpired) where.expiresAt = { gte: new Date() };

    if (filters.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
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
