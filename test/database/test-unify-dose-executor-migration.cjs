const assert = require('node:assert/strict');
const fs = require('node:fs');
const { Client } = require('pg');
const { loadTestEnvironment } = require('./test-environment.cjs');

loadTestEnvironment();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TEMP TABLE "Professional" (id text PRIMARY KEY, "userId" text NOT NULL);
      CREATE TEMP TABLE "Dose" (
        id text PRIMARY KEY, "administeredById" text, "performedById" text,
        CONSTRAINT "Dose_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Professional"(id)
      );
      CREATE INDEX "Dose_performedById_idx" ON "Dose" ("performedById");
      CREATE TEMP TABLE "ClinicalCommand" (id text PRIMARY KEY, result jsonb);
      CREATE FUNCTION pg_temp.reject_dose_update() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Immutable dose'; END;
      $$;
      CREATE TRIGGER administered_configured_dose_immutability BEFORE UPDATE ON "Dose"
        FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_dose_update();
      INSERT INTO "Professional" VALUES ('professional-executor', 'user-executor');
      INSERT INTO "Dose" VALUES ('applied', 'user-recorder', 'professional-executor'), ('legacy', 'legacy-executor', NULL);
      INSERT INTO "ClinicalCommand" VALUES ('command', '{"dose":{"id":"applied","administeredById":"user-recorder","performedById":"professional-executor"},"successor":{"id":"next","administeredById":null,"performedById":null}}');
    `);
    const sql = fs.readFileSync(
      'prisma/migrations/20260926000000_unify_dose_executor/migration.sql', 'utf8',
    ).replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '');
    await client.query(sql);
    const doses = await client.query('SELECT * FROM "Dose" ORDER BY id');
    assert.deepEqual(doses.rows, [
      { id: 'applied', administeredById: 'user-executor' },
      { id: 'legacy', administeredById: 'legacy-executor' },
    ]);
    const command = await client.query('SELECT result FROM "ClinicalCommand"');
    assert.deepEqual(command.rows[0].result, {
      dose: { id: 'applied', administeredById: 'user-executor' },
      successor: { id: 'next', administeredById: null },
    });
    const trigger = await client.query(`SELECT tgenabled FROM pg_trigger
      WHERE tgrelid = 'pg_temp."Dose"'::regclass AND tgname = 'administered_configured_dose_immutability'`);
    assert.equal(trigger.rows[0].tgenabled, 'O');
    console.log('Migration regression passed: executor preserved, legacy preserved, replay updated, trigger restored.');
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
