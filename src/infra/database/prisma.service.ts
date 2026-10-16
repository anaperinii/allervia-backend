import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 3000,
      statement_timeout: 30_000,
    });
    const adapter = new PrismaPg(pool, { disposeExternalPool: true });
    super({
      adapter,

      errorFormat: 'minimal',
      log:
        process.env.NODE_ENV !== 'production' &&
        process.env.PRISMA_DEBUG_LOGS === 'true'
          ? ['query', 'info', 'warn', 'error']
          : [],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
