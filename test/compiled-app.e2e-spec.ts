import { execFile, spawn, ChildProcess } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import request from 'supertest';
import type { ErrorBody } from './support/http';

const execFileAsync = promisify(execFile);
const ROOT = resolve(__dirname, '..');
const ENTRYPOINT = resolve(ROOT, 'dist', 'src', 'main.js');
const PROVISIONING_KEY = 'compiled-e2e-provisioning-key-01';

function newestSourceMtime(directory: string): number {
  let newest = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestSourceMtime(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.includes('.spec.')) {
      newest = Math.max(newest, statSync(full).mtimeMs);
    }
  }
  return newest;
}

function needsBuild(): boolean {
  if (!existsSync(ENTRYPOINT)) return true;

  return newestSourceMtime(resolve(ROOT, 'src')) > statSync(ENTRYPOINT).mtimeMs;
}

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('porta não atribuída'));
        return;
      }
      server.close(() => resolvePort(address.port));
    });
  });
}

async function waitForReady(baseUrl: string, child: ChildProcess) {
  const deadline = Date.now() + 30_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`processo compilado encerrou com ${child.exitCode}`);
    }
    try {
      const response = await request(baseUrl).get('/health/live');
      if (response.status === 200) return;
      lastError = new Error(`health/live respondeu ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`aplicação compilada não ficou pronta: ${String(lastError)}`);
}

describe('Compiled entrypoint serves the same HTTP pipeline (e2e)', () => {
  let child: ChildProcess;
  let baseUrl: string;

  beforeAll(async () => {
    if (needsBuild()) {
      await execFileAsync('npm', ['run', 'build'], {
        cwd: ROOT,
        shell: process.platform === 'win32',
        timeout: 180_000,
      });
    }
    const port = await freePort();
    baseUrl = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, [ENTRYPOINT], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        SUPER_ADMIN_REGISTRATION_KEY: PROVISIONING_KEY,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForReady(baseUrl, child);
  }, 240_000);

  afterAll(async () => {
    if (child && child.exitCode === null) {
      child.kill();
      await new Promise((r) => setTimeout(r, 500));
      if (child.exitCode === null && child.pid) {
        try {
          process.kill(child.pid, 'SIGKILL');
        } catch {
          return;
        }
      }
    }
  });

  it('answers readiness against the real database', async () => {
    const response = await request(baseUrl).get('/health/ready');
    expect(response.status).toBe(200);
  });

  it('rejects an unauthenticated protected route with the production envelope', async () => {
    const response = await request(baseUrl).get('/account/me');
    const body = response.body as ErrorBody;
    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      statusCode: 401,
      code: 'SESSION_MISSING',
    });
    expect(typeof body.message).toBe('string');
    expect(response.headers['x-request-id']).toBe(body.requestId);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('serializes validation failures through the production pipe', async () => {
    const response = await request(baseUrl)
      .post('/admin/provisioning/organizations')
      .set('x-provisioning-key', PROVISIONING_KEY)
      .set('Content-Type', 'application/json')
      .send({
        organization: { name: '', taxId: '' },
        administrator: { email: 'invalid', fullName: '' },
      });
    const body = response.body as ErrorBody;
    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.fieldErrors).toBeDefined();
    expect(Object.keys(body.fieldErrors ?? {}).length).toBeGreaterThan(0);
    const organizationCount = await request(baseUrl).get('/health/ready');
    expect(organizationCount.status).toBe(200);
  });

  it('enforces CSRF/origin policy on pre-auth login exactly like the guard contract', async () => {
    const response = await request(baseUrl)
      .post('/auth/sessions')
      .set('Content-Type', 'application/json')
      .send({});
    const body = response.body as ErrorBody;
    expect(response.status).toBe(403);
    expect(typeof body.code).toBe('string');
    expect(body.statusCode).toBe(403);
  });

  it('exposes Swagger only through the entrypoint-configured document route', async () => {
    const response = await request(baseUrl).get('/api');
    expect([200, 301, 302]).toContain(response.status);
  });
});
