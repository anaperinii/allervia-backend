import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ITransactionContext } from 'src/database/transaction.interface';
import { ProfessionalRepository } from './professional.repository';
import {
  CreateProfessionalData,
  UpdateProfessionalData,
} from './professional.interface';

@Injectable()
export class PrismaProfessionalRepository extends ProfessionalRepository {
  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async create(data: CreateProfessionalData, tx?: ITransactionContext) {
    const client = this.prismaService.getClient(tx);

    return client.professional.create({ data });
  }

  async findById(id: string, tx?: ITransactionContext) {
    const client = this.prismaService.getClient(tx);

    return client.professional.findUnique({ where: { id } });
  }

  async findByUserId(userId: string, tx?: ITransactionContext) {
    const client = this.prismaService.getClient(tx);

    return client.professional.findUnique({ where: { userId } });
  }

  async update(
    { id, ...data }: UpdateProfessionalData,
    tx?: ITransactionContext,
  ) {
    const client = this.prismaService.getClient(tx);

    return client.professional.update({ where: { id }, data });
  }
}
