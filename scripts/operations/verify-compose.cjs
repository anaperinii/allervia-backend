// Exercises the isolated Compose installation, never the developer database.
const https = require('node:https');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const root = resolve(__dirname, '../..');
const origin = 'https://localhost:8443';
const ca = readFileSync(resolve(root, 'artifacts/local-ca.crt'));
const checks = [];
const cookies = new Map();
function request(path, { method = 'GET', body, headers = {}, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = https.request(origin + path, {
      ca, method, timeout: 12000,
      headers: { Origin: origin, Cookie: cookie ?? [...cookies].map(([k,v]) => `${k}=${v}`).join('; '),
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...headers },
    }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        for (const item of res.headers['set-cookie'] ?? []) {
          const pair = item.split(';')[0]; const at = pair.indexOf('=');
          cookies.set(pair.slice(0, at), pair.slice(at + 1));
        }
        let body; try { body = JSON.parse(raw); } catch { body = raw; }
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.end(data);
  });
}
function pass(name) { checks.push(name); console.log(`PASS ${name}`); }
async function main() {
  for (const path of ['/backend/health/live', '/backend/health/ready']) {
    const r = await request(path); assert.equal(r.status, 200); assert.match(r.headers['cache-control'], /no-store/);
  }
  pass('TLS certificate chain and hostname verified; liveness/readiness through proxy');
  const spa = await request('/login'); assert.equal(spa.status, 200); assert.match(spa.headers['content-type'], /text\/html/);
  assert.match(spa.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal((await request('/assets/not-existing.js')).status, 404);
  const missing = await request('/backend/not-existing'); assert.equal(missing.status, 404); assert.equal(typeof missing.body, 'object');
  pass('Compiled SPA, CSP, missing asset and API fallback isolation');
  const credentials = { email: 'medico.aurora@demo.allervia.local', password: 'Demo!Allervia#2026' };
  assert.equal((await request('/backend/auth/sessions', { method: 'POST', body: credentials })).status, 403);
  const pre = await request('/backend/auth/csrf'); assert.equal(pre.status, 200);
  const login = await request('/backend/auth/sessions', { method: 'POST', body: credentials, headers: { 'X-CSRF-Token': pre.body.csrfToken } });
  assert.equal(login.status, 200); assert.equal(login.body.authenticated, true);
  const sessionCookie = login.headers['set-cookie'].find(v => v.startsWith('__Host-allervia_session_v2='));
  assert.ok(sessionCookie); for (const value of ['Secure', 'HttpOnly', 'Path=/']) assert.ok(sessionCookie.includes(value));
  assert.ok(!/Domain=/i.test(sessionCookie));
  assert.equal((await request('/backend/account/me')).status, 200);
  pass('Pre-auth CSRF required; production session cookie and authenticated read');
  const headers = { 'X-CSRF-Token': login.body.csrfToken, 'X-Session-Context': login.body.session.id };
  const payload = { subject: 'E10 isolated operational verification', message: 'Synthetic local validation only.' };
  assert.equal((await request('/backend/support-requests', { method: 'POST', body: payload })).status, 403);
  assert.equal((await request('/backend/support-requests', { method: 'POST', body: payload, headers: { ...headers, Origin: 'https://untrusted.invalid' } })).status, 403);
  assert.equal((await request('/backend/support-requests', { method: 'POST', body: payload, headers: { ...headers, 'X-Session-Context': 'wrong-context' } })).status, 401);
  assert.equal((await request('/backend/support-requests', { method: 'POST', body: payload, headers })).status, 201);
  pass('Mutation accepted only with allowed origin, CSRF and session context');
  const saved = [...cookies].map(([k,v]) => `${k}=${v}`).join('; ');
  const logout = await request('/backend/auth/logout', { method: 'POST', body: {}, headers });
  assert.ok([200,204].includes(logout.status));
  assert.equal((await request('/backend/account/me', { cookie: saved })).status, 401);
  pass('Logout immediately rejects replayed cookie');
  const marker = randomUUID();
  const demo = await request('/backend/demo-requests', { method: 'POST', body: {
    requestId: marker, name: 'E10', lastName: 'Synthetic validation', email: `e10-${marker}@example.test`,
    phone: '11999999999', role: 'doctor', solution: 'single_clinic', specialty: 'Test', professionals: 1,
  } });
  assert.equal(demo.status, 202);
  let captured = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const inbox = await fetch('http://localhost:8025/api/v1/messages').then(r => r.json());
    captured = (inbox.messages ?? []).some(m => String(m.MessageID).includes(demo.body.id));
    if (captured) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(captured, 'Demo notification did not reach local SMTP capture');
  pass('Demo request persisted and delivered through required STARTTLS to local capture');
  mkdirSync(resolve(root, 'artifacts'), { recursive: true });
  writeFileSync(resolve(root, 'artifacts/compose-verification.json'), JSON.stringify({ date: new Date().toISOString(), checks }, null, 2));
}
main().catch(error => { console.error(error.message || error.code || error.name); process.exitCode = 1; });
