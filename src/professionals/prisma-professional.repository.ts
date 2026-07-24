import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { Prisma } from '@prisma/client';
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

  async create(data: CreateProfessionalData, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prismaService;

    return client.professional.create({ data });
  }

  async findById(id: string) {
    return this.prismaService.professional.findUnique({ where: { id } });
  }

  async findByUserId(userId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prismaService;

    return client.professional.findUnique({ where: { userId } });
  }

  async update({ id, ...data }: UpdateProfessionalData) {
    return this.prismaService.professional.update({ where: { id }, data });
  }
}
