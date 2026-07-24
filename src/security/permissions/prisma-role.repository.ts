import { Injectable } from '@nestjs/common';
import { Role, Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IRoleRepository } from './role.repository';

@Injectable()
export class PrismaRoleRepository extends IRoleRepository {
  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async grant(
    data: { professionalId: string; role: Role; grantedById: string },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prismaService;

    return client.professionalRole.create({
      data: {
        professionalId: data.professionalId,
        role: data.role,
        grantedById: data.grantedById,
      },
    });
  }

  async findById(id: string) {
    return this.prismaService.professionalRole.findUnique({ where: { id } });
  }

  async findActiveByProfessional(professionalId: string) {
    return this.prismaService.professionalRole.findMany({
      where: { professionalId, revokedAt: null },
    });
  }

  async findActiveByProfessionalAndRole(
    professionalId: string,
    role: Role,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prismaService;

    return client.professionalRole.findFirst({
      where: { professionalId, role, revokedAt: null },
    });
  }

  async revoke(id: string, revokedById: string) {
    return this.prismaService.professionalRole.update({
      where: { id },
      data: { revokedAt: new Date(), revokedById },
    });
  }
}
