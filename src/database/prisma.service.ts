import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ITransactionContext } from './transaction.interface';
import { ITransactionManager } from './transaction-manager.interface';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy, ITransactionManager {
  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    super({ 
      adapter, 
      log: ['query', 'info', 'warn', 'error'] 
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async transaction<T>(
    callback: (tx: ITransactionContext) => Promise<T>
  ): Promise<T> {
    return this.$transaction(async (prismaTransaction) => {
      return callback(prismaTransaction as ITransactionContext);
    });
  }

  getClient(tx?: ITransactionContext): Prisma.TransactionClient | this {
    return (tx as Prisma.TransactionClient) || this;
  }
}