import { Injectable } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ITransactionContext } from 'src/database/transaction.interface';
import { ITransactionManager } from 'src/database/transaction-manager.interface';

@Injectable()
export class TestPrismaService 
    extends PrismaClient 
    implements ITransactionManager 
{
    constructor() {
        const pool = new Pool({ 
            connectionString: process.env.DATABASE_URL 
        });
        const adapter = new PrismaPg(pool);
        
        super({ 
            adapter, 
            log: process.env.DEBUG_TESTS === 'true' 
                ? ['query', 'info', 'warn', 'error'] 
                : ['error']
        });
    }

    // ✅ Método transaction customizado
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

    // ✅ Método cleanAll
    async cleanAll(): Promise<void> {
        const tables = [
            'AuditLog',
            'Dose',
            'Immunotherapy',
            'InternalUserInvite',
            'Membership',
            'Patient',
            'UserRole',
            'Role',
            'User',
            'Organization'
        ];

        console.log('🧹 Limpando banco de testes...');

        for (const table of tables) {
            try {
                await this.$executeRawUnsafe(
                    `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`
                );
            } catch (error: any) {
                if (!error.message.includes('does not exist')) {
                    console.warn(`⚠️  Aviso ao limpar ${table}:`, error.message);
                }
            }
        }

        console.log('✅ Banco limpo com sucesso');
    }

    // ✅ Outros métodos úteis
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
                `SELECT COUNT(*) as count FROM "${tableName}";`
            );
            return Number(result[0].count);
        } catch (error) {
            return 0;
        }
    }

    async showStats(): Promise<void> {
        console.log('\n📊 Estatísticas do Banco de Testes:');
        console.log('─────────────────────────────────────');
        
        const tables = [
            'AuditLog',
            'Dose',
            'Immunotherapy',
            'InternalUserInvite',
            'Membership',
            'Patient',
            'UserRole',
            'Role',
            'User',
            'Organization'
        ];

        for (const table of tables) {
            if (await this.tableExists(table)) {
                const count = await this.countRecords(table);
                console.log(`  ${table.padEnd(20)} → ${count} registro(s)`);
            }
        }
        
        console.log('─────────────────────────────────────\n');
    }
}