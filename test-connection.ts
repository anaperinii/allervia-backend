import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function test() {
  try {
    const count = await prisma.user.count();
    console.log('✅ Conexão OK! Número de registros na tabela User:', count);

  } catch (error) {
    console.error('❌ Erro na conexão:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();