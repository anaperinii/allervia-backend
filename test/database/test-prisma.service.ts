import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const TABLES = [
  'AuditLog',
  'DoseObservation',
  'Dose',
  'Immunotherapy',
  'ProfessionalRole',
  'InternalUserInvite',
  'Patient',
  'Professional',
  'User',
  'Organization',
];

@Injectable()
export class TestPrismaService extends PrismaClient {
  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log:
        process.env.DEBUG_TESTS === 'true'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async cleanAll(): Promise<void> {
    console.log('🧹 Limpando banco de testes...');

    for (const table of TABLES) {
      try {
        await this.$executeRawUnsafe(
          `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`,
        );
      } catch (error: any) {
        if (!error.message.includes('does not exist')) {
          console.warn(`⚠️  Aviso ao limpar ${table}:`, error.message);
        }
      }
    }

    console.log('✅ Banco limpo com sucesso');
  }

  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.$queryRaw<Array<{ exists: boolean }>>`
            SELECT EXISTS (
                SELECT FROM pg_tables
                WHERE schemaname = 'public'
                AND tablename = ${tableName}
            );
        `;

    return result[0]?.exists ?? false;
  }

  async countRecords(tableName: string): Promise<number> {
    try {
      const result = await this.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM "${tableName}";`,
      );
      return Number(result[0].count);
    } catch {
      return 0;
    }
  }

  async showStats(): Promise<void> {
    console.log('\n📊 Estatísticas do Banco de Testes:');
    console.log('─────────────────────────────────────');

    for (const table of TABLES) {
      if (await this.tableExists(table)) {
        const count = await this.countRecords(table);
        console.log(`  ${table.padEnd(20)} → ${count} registro(s)`);
      }
    }

    console.log('─────────────────────────────────────\n');
  }
}
