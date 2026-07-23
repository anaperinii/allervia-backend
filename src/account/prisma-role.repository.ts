import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { ITransactionContext } from 'src/database/transaction.interface';
import { IRoleRepository } from './role.repository';

@Injectable()
export class PrismaRoleRepository extends IRoleRepository {
  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async grant(
    data: { professionalId: string; role: Role; grantedById: string },
    tx?: ITransactionContext,
  ) {
    const client = this.prismaService.getClient(tx);

    return client.professionalRole.create({
      data: {
        professionalId: data.professionalId,
        role: data.role,
        grantedById: data.grantedById,
      },
    });
  }

  async findById(id: string, tx?: ITransactionContext) {
    const client = this.prismaService.getClient(tx);

    return client.professionalRole.findUnique({ where: { id } });
  }

  async findActiveByProfessional(
    professionalId: string,
    tx?: ITransactionContext,
  ) {
    const client = this.prismaService.getClient(tx);

    return client.professionalRole.findMany({
      where: { professionalId, revokedAt: null },
    });
  }

  async findActiveByProfessionalAndRole(
    professionalId: string,
    role: Role,
    tx?: ITransactionContext,
  ) {
    const client = this.prismaService.getClient(tx);

    return client.professionalRole.findFirst({
      where: { professionalId, role, revokedAt: null },
    });
  }

  async revoke(id: string, revokedById: string, tx?: ITransactionContext) {
    const client = this.prismaService.getClient(tx);

    return client.professionalRole.update({
      where: { id },
      data: { revokedAt: new Date(), revokedById },
    });
  }
}
