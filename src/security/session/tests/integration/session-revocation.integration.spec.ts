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
import { SessionConfig } from '../../session.config';
import {
  findCookie,
  joinCookies,
  readBody,
  type CsrfBody,
  type ErrorBody,
  type SessionBody,
} from 'test/support/http';

const PASSWORD = 'Senha!Forte#2026';
const ORIGIN = 'http://127.0.0.1';
const SESSION_COOKIE = 'allervia_session_v2';

describe('Revogação de sessões e política CSRF de mutações - Integração HTTP', () => {
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

  async function revokedReason(sessionId: string) {
    const stored = await prisma.authSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    return stored.revokedReason;
  }

  it('revokes every session on logout-all and keeps other accounts untouched', async () => {
    const user = await createProfessional();
    const a1 = await login(user.email);
    const a2 = await login(user.email);
    const other = await createProfessional();
    const b1 = await login(other.email);

    await server().get('/account/me').set('Cookie', a2.cookie).expect(200);
    await server().get('/account/me').set('Cookie', b1.cookie).expect(200);

    await server()
      .post('/auth/logout-all')
      .set(headers(a1))
      .send({})
      .expect(204);

    await server().get('/account/me').set('Cookie', a1.cookie).expect(401);
    await server().get('/account/me').set('Cookie', a2.cookie).expect(401);
    await server().get('/account/me').set('Cookie', b1.cookie).expect(200);
    expect(await revokedReason(a2.sessionId)).toBe('LOGOUT_ALL');
  });

  it('cuts every session of a member disabled by the administrator', async () => {
    const admin = await factories.users.createAuthenticatedAdmin({
      password: await hash(PASSWORD, 10),
    });
    const member = await factories.users.createColleagueWithRoles(
      admin.organizationId,
      ['PHYSICIAN'],
      { password: await hash(PASSWORD, 10) },
    );
    const memberSession = await login(member.email);
    const adminSession = await login(admin.email);

    await server()
      .get('/account/me')
      .set('Cookie', memberSession.cookie)
      .expect(200);

    await server()
      .patch('/professionals/' + member.professionalId + '/access')
      .set(headers(adminSession))
      .send({ isActive: false })
      .expect(200);

    await server()
      .get('/account/me')
      .set('Cookie', memberSession.cookie)
      .expect(401);
    await server()
      .post('/auth/session/activity')
      .set(headers(memberSession))
      .send({})
      .expect(401);
    expect(await revokedReason(memberSession.sessionId)).toBe(
      'ACCOUNT_DISABLED',
    );
  });

  it('applies the content-type policy to authenticated mutations', async () => {
    const user = await createProfessional();
    const s = await login(user.email);

    const withoutHeader = await server()
      .post('/auth/session/activity')
      .set(headers(s))
      .send(JSON.stringify({ ping: true }))
      .unset('Content-Type')
      .expect(415);
    expect(readBody<ErrorBody>(withoutHeader).code).toBe(
      'UNSUPPORTED_CONTENT_TYPE',
    );

    await server().post('/auth/session/activity').set(headers(s)).expect(204);

    const textPlain = await server()
      .post('/auth/session/activity')
      .set(headers(s))
      .set('Content-Type', 'text/plain')
      .send('ping')
      .expect(415);
    expect(readBody<ErrorBody>(textPlain).code).toBe(
      'UNSUPPORTED_CONTENT_TYPE',
    );
  });

  it('rejects mutations whose session context is missing or from another session', async () => {
    const user = await createProfessional();
    const s1 = await login(user.email);
    const s2 = await login(user.email);

    const foreignContext = await server()
      .post('/auth/session/activity')
      .set(headers(s1))
      .set('X-Session-Context', s2.sessionId)
      .send({})
      .expect(401);
    expect(readBody<ErrorBody>(foreignContext).code).toBe(
      'SESSION_CONTEXT_CHANGED',
    );

    const missingContext = await server()
      .post('/auth/session/activity')
      .set('Cookie', s1.cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', s1.csrfToken)
      .send({})
      .expect(403);
    expect(readBody<ErrorBody>(missingContext).code).toBe(
      'SESSION_CONTEXT_REQUIRED',
    );
  });

  it('enforces origin rules per method', async () => {
    const user = await createProfessional();
    const s = await login(user.email);

    const foreignOrigin = await server()
      .post('/auth/session/activity')
      .set(headers(s))
      .set('Origin', 'https://evil.example')
      .send({})
      .expect(403);
    expect(readBody<ErrorBody>(foreignOrigin).code).toBe('ORIGIN_NOT_ALLOWED');

    const missingOrigin = await server()
      .post('/auth/session/activity')
      .set('Cookie', s.cookie)
      .set('X-CSRF-Token', s.csrfToken)
      .set('X-Session-Context', s.sessionId)
      .send({})
      .expect(403);
    expect(readBody<ErrorBody>(missingOrigin).code).toBe('ORIGIN_NOT_ALLOWED');

    const read = await server()
      .get('/account/me')
      .set('Cookie', s.cookie)
      .set('Origin', 'https://evil.example')
      .expect(200);
    expect(read.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('expires sessions at the configured idle and absolute thresholds', async () => {
    const config = module.get(SessionConfig);
    const user = await createProfessional();
    const now = Date.now();

    const idle = await login(user.email);
    await prisma.authSession.update({
      where: { id: idle.sessionId },
      data: { lastInteractiveAt: new Date(now - config.idleTimeoutMs - 1000) },
    });
    await server().get('/account/me').set('Cookie', idle.cookie).expect(401);
    expect(await revokedReason(idle.sessionId)).toBe('IDLE_TIMEOUT');

    const active = await login(user.email);
    await prisma.authSession.update({
      where: { id: active.sessionId },
      data: {
        lastInteractiveAt: new Date(now - config.idleTimeoutMs + 60_000),
      },
    });
    await server().get('/account/me').set('Cookie', active.cookie).expect(200);

    const absolute = await login(user.email);
    await prisma.authSession.update({
      where: { id: absolute.sessionId },
      data: { expiresAt: new Date(now - 1000) },
    });
    await server()
      .get('/account/me')
      .set('Cookie', absolute.cookie)
      .expect(401);
    expect(await revokedReason(absolute.sessionId)).toBe('ABSOLUTE_TIMEOUT');
  });
});
