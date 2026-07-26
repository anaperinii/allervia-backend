import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  UserCreationData,
  UserUpdateData,
} from 'src/account/account.interface';
import { IUserRepository } from 'src/account/user.repository';

@Injectable()
export class PrismaUserRepository extends IUserRepository {
  constructor(private prismaService: PrismaService) {
    super();
  }

  async create(user: UserCreationData, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prismaService;

    return client.user.create({ data: user });
  }

  async update(user: Partial<UserUpdateData>) {
    return this.prismaService.user.update({
      where: { id: user.id },
      data: {
        email: user.email,
        password: user.password,
        isActive: user.isActive,
        isArchived: user.isArchived,
      },
    });
  }

  async findUserByEmail(email: string) {
    return this.prismaService.user.findFirst({
      where: { email, isActive: true, isArchived: false },
    });
  }

  async findUserById(id: string) {
    return this.prismaService.user.findFirst({ where: { id } });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prismaService.user.count({ where: { email } });

    return count > 0;
  }

  async changePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prismaService.user.update({
      where: { id: userId },
      data: { password: passwordHash, tokenVersion: { increment: 1 } },
    });
  }
}
