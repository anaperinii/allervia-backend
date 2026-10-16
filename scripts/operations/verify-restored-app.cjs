// Run inside a separate backend container with DATABASE_URL pointing to the restore.
const assert = require('node:assert/strict');
async function main() {
  assert.match(process.argv[2] ?? '', /^allervia_restore_\d+$/);
  const base = 'http://localhost:3000';
  const origin = 'https://localhost:8443';
  assert.equal((await fetch(`${base}/health/ready`)).status, 200);
  const pre = await fetch(`${base}/auth/csrf`);
  const csrf = await pre.json();
  const cookie = pre.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  const login = await fetch(`${base}/auth/sessions`, { method: 'POST', headers: {
    Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken,
  }, body: JSON.stringify({ email: 'medico.aurora@demo.allervia.local', password: 'Demo!Allervia#2026' }) });
  assert.equal(login.status, 200);
  const envelope = await login.json(); assert.equal(envelope.authenticated, true);
  const session = login.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  for (const path of ['/account/me', '/patients', '/immunotherapies/list']) {
    const r = await fetch(base + path, { headers: { Cookie: session } });
    assert.equal(r.status, 200, `Restored read ${path}`);
    const body = await r.json(); assert.ok(body);
  }
  console.log('PASS restored application: readiness, login, account, patients and immunotherapies');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
