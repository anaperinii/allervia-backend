import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import environment from './test-environment.cjs';

const { assertTestDatabase } = environment as {
  assertTestDatabase(this: void, env: NodeJS.ProcessEnv): void;
};

const TABLES = [
  'Notification',
  'NotificationPreference',
  'OutboxEvent',
  'SupportRequest',
  'ContactRequest',
  'Appointment',
  'DoseObservationAddendum',
  'TherapyLifecycleEvent',
  'AuthAttempt',
  'PreAuthChallenge',
  'MfaRecoveryCode',
  'MfaCredential',
  'AuthSession',
  'RegistrationCommand',
  'ClinicalCommand',
  'OrganizationProtocolDefault',
  'ProtocolPrescription',
  'ProtocolVersion',
  'TreatmentProtocol',
  'VerificationToken',
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
    assertTestDatabase(process.env);
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const adapter = new PrismaPg(pool, { disposeExternalPool: true });

    super({
      adapter,
      log:
        process.env.DEBUG_TESTS === 'true'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async cleanAll(): Promise<void> {
    assertTestDatabase(process.env);
    // Static table names only. One statement makes cleanup atomic and fails on schema drift.
    await this.$executeRawUnsafe(
      `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE;`,
    );
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
    console.log(
      'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€',
    );

    for (const table of TABLES) {
      if (await this.tableExists(table)) {
        const count = await this.countRecords(table);
        console.log(`  ${table.padEnd(20)} â†’ ${count} registro(s)`);
      }
    }

    console.log(
      'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n',
    );
  }
}
