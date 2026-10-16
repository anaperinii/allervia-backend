const { spawnSync } = require('node:child_process');
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '../..');
const command = process.argv[2];
const compose = ['compose', '--env-file', '.env.compose.local', '-f', 'compose.validation.yml', 'exec', '-T', 'db'];
function run(args, input) {
  const result = spawnSync('docker', [...compose, ...args], { cwd: root, input, maxBuffer: 128 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error('Local database operation failed. Inspect the local service; no credentials are printed.');
  }
  return result.stdout;
}
const folder = resolve(root, 'artifacts/recovery');
mkdirSync(folder, { recursive: true });
const backup = resolve(folder, 'validation.dump');
if (command === 'backup') {
  const data = run(['pg_dump', '-U', 'allervia', '-d', 'allervia_demo', '-Fc']);
  writeFileSync(backup, data, { flag: 'wx', mode: 0o600 });
  console.log('Local backup created in artifacts/recovery/validation.dump. Keep private.');
} else if (command === 'restore-check') {
  const data = readFileSync(backup);
  // New database only. Never drop, overwrite or restore into the live database.
  const name = `allervia_restore_${Date.now()}`;
  const started = Date.now();
  run(['createdb', '-U', 'allervia', name]);
  run(['pg_restore', '-U', 'allervia', '-d', name, '--exit-on-error', '--no-owner'], data);
  const counts = run(['psql', '-U', 'allervia', '-d', name, '-At', '-c', 'SELECT (SELECT count(*) FROM "Patient"), (SELECT count(*) FROM "Dose"), (SELECT count(*) FROM "AuditLog"), (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL);']).toString().trim();
  const report = { restoredDatabase: name, durationMs: Date.now() - started, counts, applicationVerification: 'pending: start a separate application against the restored database' };
  writeFileSync(resolve(folder, `${name}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} else {
  throw new Error('Use backup or restore-check.');
}
