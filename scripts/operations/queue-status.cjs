const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { disposeExternalPool: true }), log: [] });
async function main() {
  const [outbox, calendar, email] = await Promise.all([
    prisma.outboxEvent.aggregate({ where: { processedAt: null }, _count: true, _min: { createdAt: true }, _max: { attempts: true } }),
    prisma.calendarSyncJob.aggregate({ where: { processedAt: null }, _count: true, _min: { createdAt: true }, _max: { attempts: true } }),
    prisma.demoRequest.aggregate({ where: { emailAcceptedAt: null }, _count: true, _min: { createdAt: true }, _max: { emailAttempts: true } }),
  ]);
  console.log(JSON.stringify({ observedAt: new Date().toISOString(), outbox, calendar, email }, null, 2));
}
main().catch(() => { console.error('Queue status unavailable.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
