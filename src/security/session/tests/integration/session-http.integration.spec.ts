import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { hash } from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { buildValidationPipe } from 'src/infra/http/validation-pipe';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { IAuthSessionRepository } from '../../auth-session.repository';
import { SessionConfig } from '../../session.config';
import {
  findCookie,
  joinCookies,
  readBody,
  type CsrfBody,
  type DeviceBody,
  type SessionBody,
} from 'test/support/http';

const PASSWORD = 'Senha!Forte#2026';
const ORIGIN = 'http://127.0.0.1';
const SESSION_COOKIE = 'allervia_session_v2';

describe('Sessão opaca, CSRF e conta pública - Integração HTTP', () => {
  let app: INestApplication<App>;
  let module: TestingModule;
  let prisma: PrismaService;
  let factories: TestFactories;

  beforeAll(async () => {
    process.env.AUTH_INSECURE_COOKIES = 'true';
    process.env.AUTH_MFA_ENFORCEMENT = 'optional';
    process.env.AUTH_ALLOWED_ORIGINS = ORIGIN;
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

    await TestDatabaseManager.connect();

    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(buildValidationPipe());
    await app.init();

    prisma = module.get(PrismaService);
    factories = new TestFactories(prisma);
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await TestDatabaseManager.cleanAll();
  });

  afterAll(async () => {
    if (app) await app.close();
    await TestDatabaseManager.disconnect();
  });

  const server = () => request(app.getHttpServer());

  async function createProfessional() {
    return factories.users.createAuthenticatedPhysicianProfessional({
      password: await hash(PASSWORD, 10),
    });
  }

  async function preAuth(): Promise<{ cookie: string; csrfToken: string }> {
    const challenge = await server().get('/auth/csrf').expect(200);
    return {
      cookie: joinCookies(challenge),
      csrfToken: readBody<CsrfBody>(challenge).csrfToken,
    };
  }

  async function login(email: string): Promise<{
    cookie: string;
    csrfToken: string;
    sessionId: string;
  }> {
    const challenge = await preAuth();

    const response = await server()
      .post('/auth/sessions')
      .set('Origin', ORIGIN)
      .set('Cookie', challenge.cookie)
      .set('X-CSRF-Token', challenge.csrfToken)
      .send({ email, password: PASSWORD })
      .expect(200);

    expect(String(response.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(response.headers['set-cookie'])).toContain('SameSite=Lax');
    const body = readBody<SessionBody>(response);
    return {
      cookie: findCookie(response, SESSION_COOKIE),
      csrfToken: body.csrfToken,
      sessionId: body.session.id,
    };
  }

  function headers(s: {
    cookie: string;
    csrfToken: string;
    sessionId: string;
  }) {
    return {
      Cookie: s.cookie,
      Origin: ORIGIN,
      'X-CSRF-Token': s.csrfToken,
      'X-Session-Context': s.sessionId,
    };
  }

  it('issues only a protected opaque cookie and stores only its hash', async () => {
    const user = await createProfessional();
    const s = await login(user.email);
    const stored = await prisma.authSession.findUniqueOrThrow({
      where: { id: s.sessionId },
    });
    expect(stored.secretHash).not.toBe(s.cookie.split('=')[1]);
    expect(stored.secretHash).toMatch(/^[a-f0-9]{64}$/);
    const response = await server()
      .get('/auth/session')
      .set('Cookie', s.cookie)
      .expect(200);
    expect(response.body).not.toHaveProperty('accessToken');
    expect(response.body).not.toHaveProperty('secretHash');
    expect(response.body).not.toHaveProperty('sessionSecret');
    expect(response.headers['cache-control']).toBe('no-store');
    const c = module.get(SessionConfig);
    expect(c.cookieName).toBe('allervia_session_v2');
  });

  it('rejects missing, malformed, duplicate, public-id and legacy bearer credentials', async () => {
    const user = await createProfessional();
    const s = await login(user.email);
    await server().get('/patients').expect(401);
    for (const value of ['bad', 'x'.repeat(43), s.sessionId])
      await server()
        .get('/patients')
        .set('Cookie', SESSION_COOKIE + '=' + value)
        .expect(401);
    await server()
      .get('/patients')
      .set('Cookie', s.cookie + '; ' + s.cookie)
      .expect(401);
    await server()
      .get('/patients')
      .set('Authorization', 'Bearer ' + s.cookie.split('=')[1])
      .expect(401);
    await server().post('/auth/refresh').send({}).expect(404);
  });

  it('requires preauthentication CSRF even without a preauth cookie', async () => {
    const user = await createProfessional();
    await server()
      .post('/auth/sessions')
      .set('Origin', ORIGIN)
      .send({ email: user.email, password: PASSWORD })
      .expect(403);
  });

  it('protects every authenticated write against missing CSRF, foreign origins and stale context', async () => {
    const user = await createProfessional();
    const s = await login(user.email);
    await server()
      .post('/auth/session/activity')
      .set('Cookie', s.cookie)
      .set('Origin', ORIGIN)
      .send({})
      .expect(403);
    await server()
      .post('/auth/session/activity')
      .set(headers(s))
      .set('Origin', 'https://evil.example')
      .send({})
      .expect(403);
    await server()
      .post('/auth/session/activity')
      .set('Cookie', s.cookie)
      .set('X-CSRF-Token', s.csrfToken)
      .send({})
      .expect(403);
    await server()
      .post('/auth/session/activity')
      .set(headers(s))
      .set('X-Session-Context', 'old-tab')
      .send({})
      .expect(401);
    await server()
      .post('/auth/session/activity')
      .set(headers(s))
      .send({})
      .expect(204);
  });

  it('rejects the CSRF of another login and never promotes the supplied session on login', async () => {
    const user = await createProfessional();
    const first = await login(user.email);
    const second = await login(user.email);
    expect(first.cookie).not.toBe(second.cookie);
    await server()
      .post('/auth/session/activity')
      .set(headers(second))
      .set('X-CSRF-Token', first.csrfToken)
      .send({})
      .expect(403);
  });

  it('revokes GET and HEAD immediately after logout, including another backend instance', async () => {
    const user = await createProfessional();
    const s = await login(user.email);
    const other = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    const instance = other.createNestApplication();
    instance.use(cookieParser());
    await instance.init();
    try {
      await request(instance.getHttpServer() as App)
        .get('/patients')
        .set('Cookie', s.cookie)
        .expect(200);
      await server().post('/auth/logout').set(headers(s)).send({}).expect(204);
      await request(instance.getHttpServer() as App)
        .get('/patients')
        .set('Cookie', s.cookie)
        .expect(401);
      await server().head('/patients').set('Cookie', s.cookie).expect(401);
    } finally {
      await instance.close();
    }
  });

  it.each([
    'account',
    'organization',
    'version',
    'missing',
    'absolute',
    'idle',
    'organization-change',
  ])('rejects current state change: %s', async (change) => {
    const user = await createProfessional();
    const s = await login(user.email);
    if (change === 'account')
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });
    if (change === 'organization')
      await prisma.organization.update({
        where: { id: user.organizationId },
        data: { isActive: false },
      });
    if (change === 'version')
      await prisma.user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } },
      });
    if (change === 'missing')
      await prisma.authSession.delete({ where: { id: s.sessionId } });
    if (change === 'absolute')
      await prisma.authSession.update({
        where: { id: s.sessionId },
        data: { expiresAt: new Date(0) },
      });
    if (change === 'idle')
      await prisma.authSession.update({
        where: { id: s.sessionId },
        data: { lastInteractiveAt: new Date(0) },
      });
    if (change === 'organization-change')
      await prisma.authSession.update({
        where: { id: s.sessionId },
        data: { organizationId: 'previous-organization' },
      });
    await server().get('/patients').set('Cookie', s.cookie).expect(401);
    await server()
      .post('/auth/session/activity')
      .set(headers(s))
      .send({})
      .expect(401);
  });

  it('uses current permissions and does not touch activity on reads', async () => {
    const user = await createProfessional();
    const s = await login(user.email);
    const before = await prisma.authSession.findUniqueOrThrow({
      where: { id: s.sessionId },
    });
    await server().get('/patients').set('Cookie', s.cookie).expect(200);
    await prisma.professionalRole.updateMany({
      where: { professionalId: user.professionalId! },
      data: { revokedAt: new Date() },
    });
    await server().get('/patients').set('Cookie', s.cookie).expect(403);
    const after = await prisma.authSession.findUniqueOrThrow({
      where: { id: s.sessionId },
    });
    expect(after.lastInteractiveAt).toEqual(before.lastInteractiveAt);
  });

  it('fails closed when the database lookup fails', async () => {
    const user = await createProfessional();
    const s = await login(user.email);
    jest
      .spyOn(module.get(IAuthSessionRepository), 'findSessionByHash')
      .mockRejectedValueOnce(new Error('Synthetic database failure'));
    const result = await server()
      .get('/patients')
      .set('Cookie', s.cookie)
      .expect(500);
    expect(result.body).not.toHaveProperty('items');
  });

  it('registers interactive activity with throttling', async () => {
    const user = await createProfessional();
    const s = await login(user.email);
    await prisma.authSession.update({
      where: { id: s.sessionId },
      data: { lastInteractiveAt: new Date(Date.now() - 120_000) },
    });
    await server()
      .post('/auth/session/activity')
      .set(headers(s))
      .send({})
      .expect(204);
    const updated = await prisma.authSession.findUniqueOrThrow({
      where: { id: s.sessionId },
    });
    expect(Date.now() - updated.lastInteractiveAt.getTime()).toBeLessThan(
      10_000,
    );
    await server()
      .post('/auth/session/activity')
      .set(headers(s))
      .send({})
      .expect(204);
    expect(
      (
        await prisma.authSession.findUniqueOrThrow({
          where: { id: s.sessionId },
        })
      ).lastInteractiveAt,
    ).toEqual(updated.lastInteractiveAt);
  });

  it('lists and revokes own devices but not another account', async () => {
    const user = await createProfessional();
    const a = await login(user.email);
    const b = await login(user.email);
    const other = await createProfessional();
    const c = await login(other.email);
    const list = await server()
      .get('/auth/sessions')
      .set(headers(a))
      .expect(200);
    expect((list.body as DeviceBody[]).map((x) => x.id).sort()).toEqual(
      [a.sessionId, b.sessionId].sort(),
    );
    await server()
      .delete('/auth/sessions/' + c.sessionId)
      .set(headers(a))
      .send({})
      .expect(404);
    await server()
      .delete('/auth/sessions/' + b.sessionId)
      .set(headers(a))
      .send({})
      .expect(204);
    await server().get('/account/me').set(headers(b)).expect(401);
    await server().get('/account/me').set(headers(a)).expect(200);
    await server()
      .post('/auth/logout-all')
      .set(headers(a))
      .send({})
      .expect(204);
    await server().get('/account/me').set(headers(a)).expect(401);
  });

  it('requires recent reauthentication before removing MFA', async () => {
    const user = await createProfessional();
    const s = await login(user.email);
    await server()
      .delete('/auth/mfa/factors/anything')
      .set(headers(s))
      .send({})
      .expect(403);
    await server()
      .post('/auth/reauthenticate')
      .set(headers(s))
      .send({ password: PASSWORD })
      .expect(200);
    await server()
      .delete('/auth/mfa/factors/anything')
      .set(headers(s))
      .send({})
      .expect(404);
  });
});
