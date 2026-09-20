import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthSessionRevokeReason } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { hash } from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { buildValidationPipe } from 'src/infra/http/validation-pipe';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import {
  findCookie,
  joinCookies,
  readBody,
  setCookies,
  type AccountBody,
  type CsrfBody,
  type DeviceBody,
  type EnrollmentBody,
  type ErrorBody,
  type SessionBody,
} from 'test/support/http';

const PASSWORD = 'Senha!Forte#2026';
const ORIGIN = 'http://127.0.0.1';
const SESSION_COOKIE = 'allervia_session';

/**
 * Exercita a sessão opaca sobre HTTP real: cookie, CSRF, revogação e a fronteira
 * pública das respostas de conta. Roda sem HTTPS, então os atributos do cookie
 * são verificados em modo de desenvolvimento explícito.
 */
describe('Sessão opaca, CSRF e conta pública - Integração HTTP', () => {
  let app: INestApplication<App>;
  let module: TestingModule;
  let prisma: PrismaService;
  let factories: TestFactories;

  beforeAll(async () => {
    process.env.AUTH_INSECURE_COOKIES = 'true';
    process.env.AUTH_MFA_ENFORCEMENT = 'optional';
    process.env.AUTH_LEGACY_BEARER = 'enabled';
    // O servidor efêmero do supertest atende em porta variável, então a origem
    // do teste é declarada explicitamente em vez de inferida do host.
    process.env.AUTH_ALLOWED_ORIGINS = ORIGIN;
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';

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

  it('recusa acesso a rota privada sem sessão', async () => {
    const response = await server().get('/account/me').expect(401);
    const body = readBody<ErrorBody>(response);

    expect(body.code).toBeDefined();
    expect(body.statusCode).toBe(401);
  });

  it('cria sessão por cookie e restaura o estado após reload', async () => {
    const user = await createProfessional();
    const challenge = await preAuth();

    const created = await server()
      .post('/auth/sessions')
      .set('Origin', ORIGIN)
      .set('Cookie', challenge.cookie)
      .set('X-CSRF-Token', challenge.csrfToken)
      .send({ email: user.email, password: PASSWORD })
      .expect(200);

    const session = setCookies(created).find((cookie) =>
      cookie.startsWith(`${SESSION_COOKIE}=`),
    );

    expect(session).toContain('HttpOnly');
    expect(session).toContain('SameSite=Lax');
    expect(session).toContain('Path=/');

    const createdBody = readBody<SessionBody>(created);
    expect(createdBody.csrfToken).toEqual(expect.any(String));
    // O corpo não devolve o segredo do cookie nem a credencial do usuário.
    expect(JSON.stringify(createdBody)).not.toContain(PASSWORD);

    const restored = await server()
      .get('/auth/session')
      .set('Cookie', findCookie(created, SESSION_COOKIE))
      .expect(200);

    const restoredBody = readBody<SessionBody>(restored);
    expect(restoredBody.authenticated).toBe(true);
    expect(restoredBody.session.id).toBe(createdBody.session.id);
    expect(restored.headers['cache-control']).toBe('no-store');
  });

  it('não distingue senha incorreta de e-mail inexistente', async () => {
    const user = await createProfessional();
    const challenge = await preAuth();

    const wrongPassword = await server()
      .post('/auth/sessions')
      .set('Origin', ORIGIN)
      .set('Cookie', challenge.cookie)
      .set('X-CSRF-Token', challenge.csrfToken)
      .send({ email: user.email, password: 'outra-senha-qualquer' })
      .expect(401);

    const unknownEmail = await server()
      .post('/auth/sessions')
      .set('Origin', ORIGIN)
      .set('Cookie', challenge.cookie)
      .set('X-CSRF-Token', challenge.csrfToken)
      .send({ email: 'desconhecido@clinica.com.br', password: PASSWORD })
      .expect(401);

    const first = readBody<ErrorBody>(wrongPassword);
    const second = readBody<ErrorBody>(unknownEmail);
    expect(first.code).toBe(second.code);
    expect(first.message).toBe(second.message);
  });

  it('responde /account/me sem segredos e com capacidades', async () => {
    const user = await createProfessional();
    const { cookie } = await login(user.email);

    const response = await server()
      .get('/account/me')
      .set('Cookie', cookie)
      .expect(200);

    const body = readBody<AccountBody>(response);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('tokenVersion');
    expect(serialized).not.toContain('secretHash');

    expect(body.user.id).toBe(user.id);
    expect(body.roles).toEqual(['PHYSICIAN']);
    expect(body.capabilities).toContain('patients:create');
    expect(body.capabilities).not.toContain('roles:manage');
    expect(body.organization?.id).toBe(user.organizationId);
    expect(body.security.sessionBased).toBe(true);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('rejeita comando autenticado por cookie sem token CSRF', async () => {
    const user = await createProfessional();
    const { cookie, csrfToken } = await login(user.email);

    const withoutToken = await server()
      .post('/account/me/password')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ currentPassword: PASSWORD, newPassword: 'Nova!Senha#2026' })
      .expect(403);

    expect(readBody<ErrorBody>(withoutToken).code).toBe('CSRF_TOKEN_INVALID');

    const foreignOrigin = await server()
      .post('/account/me/password')
      .set('Origin', 'https://site-terceiro.example')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ currentPassword: PASSWORD, newPassword: 'Nova!Senha#2026' })
      .expect(403);

    expect(readBody<ErrorBody>(foreignOrigin).code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('encerra a sessão no logout e recusa a credencial antiga', async () => {
    const user = await createProfessional();
    const { cookie, csrfToken } = await login(user.email);

    await server()
      .post('/auth/logout')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .expect(204);

    const afterLogout = await server()
      .get('/account/me')
      .set('Cookie', cookie)
      .expect(401);

    expect(readBody<ErrorBody>(afterLogout).code).toBe('SESSION_REVOKED');
  });

  it('lista dispositivos do próprio usuário e revoga o escolhido', async () => {
    const user = await createProfessional();
    const first = await login(user.email);
    const second = await login(user.email);

    const devices = await server()
      .get('/auth/sessions')
      .set('Cookie', second.cookie)
      .expect(200);

    const listed = readBody<DeviceBody[]>(devices);
    expect(listed).toHaveLength(2);
    expect(
      listed.find((device) => device.id === second.sessionId)?.current,
    ).toBe(true);

    await server()
      .delete(`/auth/sessions/${first.sessionId}`)
      .set('Origin', ORIGIN)
      .set('Cookie', second.cookie)
      .set('X-CSRF-Token', second.csrfToken)
      .expect(204);

    await server().get('/account/me').set('Cookie', first.cookie).expect(401);
    await server().get('/account/me').set('Cookie', second.cookie).expect(200);
  });

  it('não permite revogar sessão de outro usuário', async () => {
    const owner = await createProfessional();
    const other = await createProfessional();
    const ownerSession = await login(owner.email);
    const otherSession = await login(other.email);

    await server()
      .delete(`/auth/sessions/${ownerSession.sessionId}`)
      .set('Origin', ORIGIN)
      .set('Cookie', otherSession.cookie)
      .set('X-CSRF-Token', otherSession.csrfToken)
      .expect(404);

    await server()
      .get('/account/me')
      .set('Cookie', ownerSession.cookie)
      .expect(200);
  });

  it('encerra todas as sessões quando a senha muda', async () => {
    const user = await createProfessional();
    const first = await login(user.email);
    const second = await login(user.email);

    await server()
      .post('/account/me/password')
      .set('Origin', ORIGIN)
      .set('Cookie', second.cookie)
      .set('X-CSRF-Token', second.csrfToken)
      .send({ currentPassword: PASSWORD, newPassword: 'Nova!Senha#2026' })
      .expect(200);

    await server().get('/account/me').set('Cookie', first.cookie).expect(401);
    await server().get('/account/me').set('Cookie', second.cookie).expect(401);

    const revoked = await prisma.authSession.findMany({
      where: { userId: user.id },
      select: { revokedReason: true },
    });
    expect(
      revoked.every(
        (session) =>
          session.revokedReason === AuthSessionRevokeReason.PASSWORD_CHANGED,
      ),
    ).toBe(true);
  });

  it('recusa sessão expirada pelo teto absoluto', async () => {
    const user = await createProfessional();
    const { cookie, sessionId } = await login(user.email);

    await prisma.authSession.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await server()
      .get('/account/me')
      .set('Cookie', cookie)
      .expect(401);

    expect(readBody<ErrorBody>(response).code).toBe('SESSION_EXPIRED');
    const stored = await prisma.authSession.findUnique({
      where: { id: sessionId },
      select: { revokedReason: true },
    });
    expect(stored?.revokedReason).toBe(
      AuthSessionRevokeReason.ABSOLUTE_TIMEOUT,
    );
  });

  it('recusa sessão parada além do limite de inatividade', async () => {
    const user = await createProfessional();
    const { cookie, sessionId } = await login(user.email);

    await prisma.authSession.update({
      where: { id: sessionId },
      data: { lastInteractiveAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    await server().get('/account/me').set('Cookie', cookie).expect(401);

    const stored = await prisma.authSession.findUnique({
      where: { id: sessionId },
      select: { revokedReason: true },
    });
    expect(stored?.revokedReason).toBe(AuthSessionRevokeReason.IDLE_TIMEOUT);
  });

  it('encerra a sessão quando a conta é desativada', async () => {
    const user = await createProfessional();
    const { cookie } = await login(user.email);

    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    const response = await server()
      .get('/account/me')
      .set('Cookie', cookie)
      .expect(401);

    expect(readBody<ErrorBody>(response).code).toBe('ACCOUNT_DISABLED');
  });

  it('exige reautenticação recente para remover um segundo fator', async () => {
    const user = await createProfessional();
    const { cookie, csrfToken } = await login(user.email);

    const enrollment = await server()
      .post('/auth/mfa/enroll')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ label: 'Teste' })
      .expect(201);

    const credentialId = readBody<EnrollmentBody>(enrollment).credentialId;

    const response = await server()
      .delete(`/auth/mfa/factors/${credentialId}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .expect(403);

    expect(readBody<ErrorBody>(response).code).toBe(
      'REAUTHENTICATION_REQUIRED',
    );
  });

  it('devolve envelope de erro com código estável na validação', async () => {
    const challenge = await preAuth();

    const response = await server()
      .post('/auth/sessions')
      .set('Origin', ORIGIN)
      .set('Cookie', challenge.cookie)
      .set('X-CSRF-Token', challenge.csrfToken)
      .send({ email: 'sem-arroba', password: '' })
      .expect(400);

    const body = readBody<ErrorBody>(response);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.fieldErrors?.email).toBeDefined();
    expect(body.requestId).toEqual(expect.any(String));
  });
});
