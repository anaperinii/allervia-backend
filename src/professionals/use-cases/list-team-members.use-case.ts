import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { buildPage, PageDto, resolvePage } from 'src/infra/http/pagination';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ListTeamQueryDto, TeamMemberDto } from '../dtos/team-member.dto';

/**
 * Equipe da organização do ator, paginada no banco. Papéis vêm dos vínculos
 * vigentes, não de um campo denormalizado: revogar um papel some da lista na
 * consulta seguinte.
 */
@Injectable()
export class ListTeamMembersUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    currentUser: AuthenticatedUserPayload,
    query: ListTeamQueryDto,
  ): Promise<PageDto<TeamMemberDto>> {
    const bounds = resolvePage(query);
    const where = this.buildWhere(currentUser.organizationId, query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.professional.findMany({
        where,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        skip: bounds.skip,
        take: bounds.take,
        select: {
          id: true,
          userId: true,
          fullName: true,
          phoneNumber: true,
          profession: true,
          councilNumber: true,
          councilUf: true,
          createdAt: true,
          user: { select: { email: true, isActive: true } },
          professionalRoles: {
            where: { revokedAt: null },
            select: { role: true },
          },
        },
      }),
      this.prisma.professional.count({ where }),
    ]);

    return buildPage(
      rows.map((row) => ({
        professionalId: row.id,
        userId: row.userId,
        fullName: row.fullName,
        email: row.user.email,
        phoneNumber: row.phoneNumber,
        profession: row.profession,
        councilNumber: row.councilNumber,
        councilUf: row.councilUf,
        roles: row.professionalRoles.map((item) => item.role),
        isActive: row.user.isActive,
        createdAt: row.createdAt,
      })),
      total,
      bounds,
    );
  }

  private buildWhere(
    organizationId: string,
    query: ListTeamQueryDto,
  ): Prisma.ProfessionalWhereInput {
    const where: Prisma.ProfessionalWhereInput = { organizationId };

    if (query.profession) where.profession = query.profession;

    if (query.role) {
      where.professionalRoles = {
        some: { role: query.role, revokedAt: null },
      };
    }

    if (query.isActive !== undefined) {
      where.user = { isActive: query.isActive, isArchived: false };
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return where;
  }
}
