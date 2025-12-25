import { TestPrismaService } from "./test-prisma.service";

export class TestDatabaseManager {
    private static instance: TestPrismaService;

    static getInstance(): TestPrismaService {
        if (!this.instance) {
            this.instance = new TestPrismaService();
        }
        return this.instance;
    }

    static async connect(): Promise<void> {
        const prisma = this.getInstance();
        await prisma.$connect();
        console.log('✅ Conectado ao banco de testes');
    }

    static async disconnect(): Promise<void> {
        if (this.instance) {
            await this.instance.$disconnect();
            console.log('✅ Desconectado do banco de testes');
        }
    }

    static async cleanAll(): Promise<void> {
        const prisma = this.getInstance();
        await prisma.cleanAll();
    }

    static async showStats(): Promise<void> {
        const prisma = this.getInstance();
        await prisma.showStats();
    }
}