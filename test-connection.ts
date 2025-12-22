import 'dotenv/config'; // Carrega o .env automaticamente
import { PrismaClient } from '@prisma/client'; // Ou o caminho custom se você definiu output no schema
import { Pool } from 'pg'; // Só se for PostgreSQL com @prisma/adapter-pg + Pool
import { PrismaPg } from '@prisma/adapter-pg';

// Exemplo para PostgreSQL (o mais comum)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function test() {
  try {
    // Teste simples: conta o número de registros em uma tabela que você sabe que existe
    // Troque 'User' pelo nome de um model do seu schema.prisma (ex: Patient, Appointment etc.)
    const count = await prisma.user.count(); // ou prisma.suaTabela.count()
    console.log('✅ Conexão OK! Número de registros na tabela User:', count);

    // Ou um teste ainda mais leve (sem depender de tabela específica):
    // await prisma.$queryRaw`SELECT 1`;
    // console.log('✅ Conexão OK! Query raw funcionou.');
  } catch (error) {
    console.error('❌ Erro na conexão:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();