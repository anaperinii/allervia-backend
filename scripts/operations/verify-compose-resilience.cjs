// Deliberate faults confined to the named local Compose project. Services recover in finally.
const { spawnSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const https = require('node:https');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const root = resolve(__dirname, '../..');
const compose = ['compose', '--env-file', '.env.compose.local', '-f', 'compose.validation.yml'];
const ca = readFileSync(resolve(root, 'artifacts/local-ca.crt'));
const checks = [];
function docker(args) {
  const r = spawnSync('docker', [...compose, ...args], { cwd: root, encoding: 'utf8', timeout: 90000 });
  if (r.status !== 0) throw new Error(`Compose operation failed: ${args[0]}`);
  return r.stdout.trim();
}
function sql(query) { return docker(['exec', '-T', 'db', 'psql', '-X', '-U', 'allervia', '-d', 'allervia_demo', '-At', '-c', query]); }
function request(path, payload) {
  return new Promise((resolve, reject) => {
    const data = payload && JSON.stringify(payload);
    const req = https.request(`https://localhost:8443/backend${path}`, { ca, timeout: 10000,
      method: data ? 'POST' : 'GET', headers: { Origin: 'https://localhost:8443', ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) },
    }, res => { let raw=''; res.on('data', c => raw+=c); res.on('end', () => resolve({ status:res.statusCode, body:JSON.parse(raw) })); });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('Timeout'))); req.end(data);
  });
}
async function until(check, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { if (await check()) return; } catch {} await new Promise(r => setTimeout(r, 1000)); }
  throw new Error('Recovery condition timed out');
}
function pass(name) { checks.push(name); console.log(`PASS ${name}`); }
async function main() {
  const countQuery = 'SELECT (SELECT count(*) FROM "Patient"), (SELECT count(*) FROM "Dose"), (SELECT count(*) FROM "AuditLog");';
  const before = sql(countQuery);
  try {
    docker(['stop', 'db']);
    assert.equal((await request('/health/live')).status, 200);
    const ready = await request('/health/ready'); assert.equal(ready.status, 503);
    assert.ok(!JSON.stringify(ready.body).includes('postgresql'));
    pass('Database outage: live 200, ready 503, sanitized error');
  } finally { docker(['start', 'db']); }
  await until(async () => (await request('/health/ready')).status === 200);
  docker(['restart', 'backend', 'web']);
  await until(async () => (await request('/health/ready')).status === 200);
  assert.equal(sql(countQuery), before);
  pass('Database and application restart preserve patient, dose and audit counts');
  let id;
  try {
    docker(['stop', 'mail-capture']);
    assert.equal((await request('/health/ready')).status, 200);
    const marker = randomUUID();
    const demo = await request('/demo-requests', { requestId: marker, name: 'E10', lastName: 'SMTP outage', email: `fault-${marker}@example.test`, phone: '11999999999', role: 'doctor', solution: 'self', specialty: 'Synthetic', professionals: 1 });
    assert.equal(demo.status, 202); id = demo.body.id;
    assert.match(id, /^[A-Za-z0-9_-]+$/);
    await until(() => sql(`SELECT count(*) FROM "DemoRequest" WHERE id='${id}' AND "emailAttempts">0 AND "emailAcceptedAt" IS NULL AND "emailErrorCode" IS NOT NULL;`) === '1');
    pass('SMTP outage preserves accepted request and records retry without failing readiness');
  } finally { docker(['start', 'mail-capture']); }
  await until(() => sql(`SELECT count(*) FROM "DemoRequest" WHERE id='${id}' AND "emailAcceptedAt" IS NOT NULL;`) === '1', 180000);
  pass('SMTP recovery processes persisted retry successfully');
  writeFileSync(resolve(root, 'artifacts/compose-resilience.json'), JSON.stringify({ date: new Date().toISOString(), checks }, null, 2));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
