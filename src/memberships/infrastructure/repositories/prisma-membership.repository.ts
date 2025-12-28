import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { Membership } from '../../domain/entities/membership.entity';
import { IMembershipRepository } from '../../domain/interfaces/membership.repository.interface';
import { MembershipInfo } from 'src/security/dtos/login-response.dto';
import { UpdateMembershipData } from 'src/memberships/domain/interfaces/memberships.interface';

@Injectable()
export class PrismaMembershipRepository extends IMembershipRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(membership: Membership): Promise<Membership> {
    const created = await this.prisma.membership.create({
      data: {
        id: membership.id,
        userId: membership.userId,
        organizationId: membership.organizationId,
        isActive: membership.isActive,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
      },
    });

    return new Membership(created);
  }

  async update(id: string, membership: Partial<UpdateMembershipData>): Promise<Membership> {
    const updated = await this.prisma.membership.update({
      where: { id },
      data: {
        isActive: membership.isActive
      },
    });

    return new Membership(updated);
  }

  async findById(id: string): Promise<Membership | null> {
    const membership = await this.prisma.membership.findUnique({
      where: { id },
    });

    return membership ? new Membership(membership) : null;
  }

  async findByUserId(userId: string): Promise<MembershipInfo[]> {
    const memberships = await this.prisma.membership.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        organization: true,
      },
    });

    return memberships.map(m => ({
      organizationId: m.organizationId,
      organizationName: m.organization.name,
    }));
  }

  async findByUserAndOrganization(
    userId: string,
    organizationId: string,
  ): Promise<Membership | null> {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: userId,
          organizationId: organizationId,
        },
      },
    });

    return membership ? new Membership(membership) : null;
  }

  async exists(userId: string, organizationId: string): Promise<boolean> {
    const count = await this.prisma.membership.count({
      where: {
        userId,
        organizationId,
      },
    });

    return count > 0;
  }
}


