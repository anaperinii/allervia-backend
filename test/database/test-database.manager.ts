import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

export class TestDatabaseManager {
    private static prismaInstance: PrismaClient;

    static getInstance(): PrismaClient {
        if (!this.prismaInstance) {
        
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL, 
        });

        const adapter = new PrismaPg(pool);
        
        this.prismaInstance = new PrismaClient({
            adapter,
            log: process.env.DEBUG_TESTS === 'true' 
            ? ['query', 'info', 'warn', 'error'] 
            : ['error'],
        });
        }
        return this.prismaInstance;
    }

    static async connect(): Promise<void> {
        const prisma = this.getInstance();
        await prisma.$connect();
        console.log('✅ Conectado ao banco de testes');
    }

    static async disconnect(): Promise<void> {
        if (this.prismaInstance) {
        await this.prismaInstance.$disconnect();
        console.log('✅ Desconectado do banco de testes');
        }
    }


    static async cleanAll(): Promise<void> {
        const prisma = this.getInstance();

        // Ordem das tabelas dependentes para as independentes
        const tables = [
            'AuditLog',
            'Dose',
            'Immunotherapy',
            'InternalUserInvite',
            'Membership',
            'Professional',
            'Patient',
            'User',
            'Organization'

        ];

        console.log('🧹 Limpando banco de testes...');

        for (const table of tables) {
        try {
            await prisma.$executeRawUnsafe(
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

    static async tableExists(tableName: string): Promise<boolean> {
        const prisma = this.getInstance();

        const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
            SELECT FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename = ${tableName}
        );
        `;

        return result[0]?.exists ?? false;
    }

    static async countRecords(tableName: string): Promise<number> {
        const prisma = this.getInstance();
        
        try {
            const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
                `SELECT COUNT(*) as count FROM "${tableName}";`
            );
            return Number(result[0].count);
        } catch (error) {
            return 0;
        }
    }

    static async showStats(): Promise<void> {
        console.log('\n📊 Estatísticas do Banco de Testes:');
        console.log('─────────────────────────────────────');
        
        const tables = [
            'AuditLog',
            'Dose',
            'Immunotherapy',
            'InternalUserInvite',
            'Membership',
            'Professional',
            'Patient',
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