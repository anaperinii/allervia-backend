// Isolated SQL upgrade fixture. Complements Prisma migrate deploy on an empty DB.
const { execFileSync, spawnSync } = require('node:child_process');
const { readFileSync, readdirSync, mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const root = resolve(__dirname, '../..');
const base = ['compose', '--env-file', '.env.compose.local', '-f', 'compose.validation.yml', 'exec', '-T', 'db'];
const database = `allervia_upgrade_${Date.now()}`;
function docker(args, input, failureExpected = false) {
  const r = spawnSync('docker', [...base, ...args], { cwd: root, input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (failureExpected) { assert.notEqual(r.status, 0); assert.match(r.stderr, /duplicate key value/); }
  else if (r.status !== 0) throw new Error(`Isolated migration check failed: ${r.stderr}`);
  return r.stdout.trim();
}
function sql(source, failureExpected = false) { return docker(['psql', '-X', '-U', 'allervia', '-d', database, '-v', 'ON_ERROR_STOP=1', '-At'], source, failureExpected); }
const previous = execFileSync('git', ['ls-tree', '--name-only', 'HEAD', 'prisma/migrations/'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').filter(p => !p.endsWith('.toml')).sort();
const all = readdirSync(resolve(root, 'prisma/migrations'), { withFileTypes: true }).filter(p => p.isDirectory()).map(p => `prisma/migrations/${p.name}`).sort();
const additions = all.filter(p => !previous.includes(p));
assert.ok(additions.length, 'No migration delta against HEAD');
const started = Date.now();
docker(['createdb', '-U', 'allervia', database]);
for (const path of previous) sql(execFileSync('git', ['show', `HEAD:${path}/migration.sql`], { cwd: root, encoding: 'utf8' }));
sql(`INSERT INTO "Organization" (id,name,"taxId") VALUES ('upgrade-org','Upgrade fixture','synthetic-upgrade');
INSERT INTO "User" (id,email,password,type) VALUES ('upgrade-user','upgrade@example.test','not-a-login-hash','PROFESSIONAL');
INSERT INTO "OutboxEvent" (id,"organizationId",kind,payload) VALUES ('upgrade-event','upgrade-org','TREATMENT_SUSPENDED','{"synthetic":true}');
INSERT INTO "InternalUserInvite" (id,token,"organizationId",email,"fullName",role,"expiresAt","isActive","createdById") VALUES
('old-invite','old-token','upgrade-org','fixture@example.test','Fixture','ADMINISTRATOR',now() + interval '1 day',false,'upgrade-user'),
('active-invite','active-token','upgrade-org','fixture@example.test','Fixture','ADMINISTRATOR',now() + interval '1 day',true,'upgrade-user');`);
for (const path of additions) sql(readFileSync(resolve(root, path, 'migration.sql'), 'utf8'));
assert.equal(sql(`SELECT revision FROM "Organization" WHERE id='upgrade-org';`), '0');
assert.equal(sql(`SELECT count(*) FROM "OutboxEvent" WHERE id='upgrade-event' AND payload->>'synthetic'='true' AND "nextAttemptAt" IS NOT NULL AND "leaseUntil" IS NULL AND "attemptId" IS NULL;`), '1');
sql(`INSERT INTO "InternalUserInvite" (id,token,"organizationId",email,"fullName",role,"expiresAt","isActive","createdById") VALUES ('second-history','history-token','upgrade-org','fixture@example.test','Fixture','ADMINISTRATOR',now(),false,'upgrade-user');`);
sql(`INSERT INTO "InternalUserInvite" (id,token,"organizationId",email,"fullName",role,"expiresAt","isActive","createdById") VALUES ('forbidden-active','forbidden-token','upgrade-org','fixture@example.test','Fixture','ADMINISTRATOR',now(),true,'upgrade-user');`, true);
assert.equal(sql(`SELECT count(*) FROM "InternalUserInvite";`), '3');
const report = { database, previousMigrationCount: previous.length, addedMigrationCount: additions.length, durationMs: Date.now()-started,
  checks: ['Previous SQL schema applied', 'Organization preserved with revision default', 'Pending outbox payload preserved and scheduling backfilled', 'Multiple historical invites accepted', 'Duplicate active invite rejected'],
  limitation: 'SQL-level fixture, not execution of the previous application or a production-volume migration. Prisma migrate deploy on empty database is tested separately.' };
mkdirSync(resolve(root, 'artifacts'), { recursive: true });
writeFileSync(resolve(root, 'artifacts/migration-upgrade-verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

