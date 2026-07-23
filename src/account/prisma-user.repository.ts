import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ITransactionContext } from 'src/database/transaction.interface';
import { UserCreationData, UserUpdateData } from 'src/account/account.interface';
import { IUserRepository } from 'src/account/user.repository';

@Injectable()
export class PrismaUserRepository extends IUserRepository {
  constructor(private prismaService: PrismaService) {
    super();
  }

  async create(user: UserCreationData, tx?: ITransactionContext) {
    const client = this.prismaService.getClient(tx);

    return client.user.create({ data: user });
  }

  async update(user: Partial<UserUpdateData>, tx?: ITransactionContext) {
    const client = this.prismaService.getClient(tx);

    return client.user.update({
      where: { id: user.id },
      data: {
        email: user.email,
        password: user.password,
        isActive: user.isActive,
        isArchived: user.isArchived,
      },
    });
  }

  async findUserByEmail(email: string, tx?: ITransactionContext) {
    const client = this.prismaService.getClient(tx);

    return client.user.findFirst({ where: { email } });
  }

  async findUserById(id: string, tx?: ITransactionContext) {
    const client = this.prismaService.getClient(tx);

    return client.user.findFirst({ where: { id } });
  }

  async existsByEmail(email: string, tx?: ITransactionContext): Promise<boolean> {
    const client = this.prismaService.getClient(tx);

    const count = await client.user.count({ where: { email } });

    return count > 0;
  }
}
