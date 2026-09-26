import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { hash } from 'bcrypt';
import { generateSync } from 'otplib';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { buildValidationPipe } from 'src/infra/http/validation-pipe';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import {
  findCookie,
  joinCookies,
  readBody,
  type AccountBody,
  type CsrfBody,
  type EnrollmentBody,
  type ErrorBody,
  type MfaChallengeBody,
  type SessionBody,
} from 'test/support/http';

const PASSWORD = 'Senha!Forte#2026';
const ORIGIN = 'http://127.0.0.1';
const SESSION_COOKIE = 'allervia_session';
const PERIOD_SECONDS = 30;

describe('Segundo fator e bearer legado - Integração HTTP', () => {
  let app: INestApplication<App>;
  let module: TestingModule;
  let prisma: PrismaService;
  let factories: TestFactories;

  beforeAll(async () => {
    process.env.AUTH_INSECURE_COOKIES = 'true';
    process.env.AUTH_MFA_ENFORCEMENT = 'optional';
    process.env.AUTH_LEGACY_BEARER = 'enabled';
    process.env.AUTH_ALLOWED_ORIGINS = ORIGIN;
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
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

  async function createProfessional(): Promise<AuthenticatedUserPayload> {
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

  async function login(email: string) {
    const challenge = await preAuth();
    return server()
      .post('/auth/sessions')
      .set('Origin', ORIGIN)
      .set('Cookie', challenge.cookie)
      .set('X-CSRF-Token', challenge.csrfToken)
      .send({ email, password: PASSWORD })
      .expect(200);
  }

  function legacyToken(user: AuthenticatedUserPayload): string {
    return module.get(JwtService).sign({
      sub: user.id,
      email: user.email,
      type: user.type,
      organizationId: user.organizationId,
      professionalId: user.professionalId,
      roles: user.roles,
      tokenVersion: 0,
    });
  }

  function totpCode(secret: string, stepsAhead = 0): string {
    return generateSync({
      secret,
      period: PERIOD_SECONDS,
      epoch: Math.floor(Date.now() / 1000) + stepsAhead * PERIOD_SECONDS,
    });
  }

  async function enrollTotp(cookie: string, csrfToken: string) {
    const enrollment = await server()
      .post('/auth/mfa/enroll')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({})
      .expect(201);

    const started = readBody<EnrollmentBody>(enrollment);

    const confirmation = await server()
      .post('/auth/mfa/enroll/confirm')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({
        credentialId: started.credentialId,
        code: totpCode(started.secret),
      })
      .expect(200);

    return {
      secret: started.secret,
      credentialId: started.credentialId,
      recoveryCodes: readBody<{ recoveryCodes: string[] }>(confirmation)
        .recoveryCodes,
    };
  }

  it('cadastra o segundo fator, emite códigos de recuperação e passa a exigi-lo no login', async () => {
    const user = await createProfessional();
    const first = await login(user.email);
    const cookie = findCookie(first, SESSION_COOKIE);
    const csrfToken = readBody<SessionBody>(first).csrfToken;

    const { secret, recoveryCodes } = await enrollTotp(cookie, csrfToken);

    expect(recoveryCodes).toHaveLength(10);
    expect(new Set(recoveryCodes).size).toBe(10);

    const challenged = await login(user.email);
    const challenge = readBody<MfaChallengeBody>(challenged);
    expect(challenge.status).toBe('MFA_REQUIRED');
    expect(challenge.challengeToken).toEqual(expect.any(String));
    expect(challenged.headers['set-cookie']).toBeUndefined();

    const verifyPreAuth = await preAuth();
    const verified = await server()
      .post('/auth/mfa/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', verifyPreAuth.cookie)
      .set('X-CSRF-Token', verifyPreAuth.csrfToken)
      .send({
        challengeToken: challenge.challengeToken,
        code: totpCode(secret, 1),
      })
      .expect(200);

    const me = await server()
      .get('/account/me')
      .set('Cookie', findCookie(verified, SESSION_COOKIE))
      .expect(200);

    const account = readBody<AccountBody>(me);
    expect(account.security.mfaEnabled).toBe(true);
    expect(account.security.mfaRequired).toBe(true);
  });

  it('aceita um código de recuperação uma única vez', async () => {
    const user = await createProfessional();
    const first = await login(user.email);
    const { recoveryCodes } = await enrollTotp(
      findCookie(first, SESSION_COOKIE),
      readBody<SessionBody>(first).csrfToken,
    );
    const [recoveryCode] = recoveryCodes;

    const challenged = await login(user.email);
    const firstPreAuth = await preAuth();

    await server()
      .post('/auth/mfa/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', firstPreAuth.cookie)
      .set('X-CSRF-Token', firstPreAuth.csrfToken)
      .send({
        challengeToken: readBody<MfaChallengeBody>(challenged).challengeToken,
        code: recoveryCode,
      })
      .expect(200);

    const second = await login(user.email);
    const secondPreAuth = await preAuth();

    const reused = await server()
      .post('/auth/mfa/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', secondPreAuth.cookie)
      .set('X-CSRF-Token', secondPreAuth.csrfToken)
      .send({
        challengeToken: readBody<MfaChallengeBody>(second).challengeToken,
        code: recoveryCode,
      })
      .expect(401);

    expect(readBody<ErrorBody>(reused).code).toBe('MFA_CODE_INVALID');
  });

  it('recusa o desafio consumido e o código inválido', async () => {
    const user = await createProfessional();
    const first = await login(user.email);
    const { secret } = await enrollTotp(
      findCookie(first, SESSION_COOKIE),
      readBody<SessionBody>(first).csrfToken,
    );

    const challenged = await login(user.email);
    const challengeToken =
      readBody<MfaChallengeBody>(challenged).challengeToken;

    const wrongCode = await preAuth();
    const invalid = await server()
      .post('/auth/mfa/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', wrongCode.cookie)
      .set('X-CSRF-Token', wrongCode.csrfToken)
      .send({ challengeToken, code: '000000' })
      .expect(401);

    expect(readBody<ErrorBody>(invalid).code).toBe('MFA_CODE_INVALID');

    const accepted = await preAuth();
    await server()
      .post('/auth/mfa/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', accepted.cookie)
      .set('X-CSRF-Token', accepted.csrfToken)
      .send({ challengeToken, code: totpCode(secret, 1) })
      .expect(200);

    const replay = await preAuth();
    const consumed = await server()
      .post('/auth/mfa/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', replay.cookie)
      .set('X-CSRF-Token', replay.csrfToken)
      .send({ challengeToken, code: totpCode(secret, 2) })
      .expect(401);

    expect(readBody<ErrorBody>(consumed).code).toBe('MFA_CHALLENGE_INVALID');
  });

  it('não emite bearer legado para conta com segundo fator confirmado', async () => {
    const user = await createProfessional();
    const first = await login(user.email);
    await enrollTotp(
      findCookie(first, SESSION_COOKIE),
      readBody<SessionBody>(first).csrfToken,
    );

    const response = await server()
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(403);

    expect(readBody<ErrorBody>(response).code).toBe('MFA_REQUIRED');
  });

  it('recusa bearer existente depois que a conta passa a exigir segundo fator', async () => {
    const user = await createProfessional();
    const token = legacyToken(user);

    await server()
      .get('/account/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const first = await login(user.email);
    await enrollTotp(
      findCookie(first, SESSION_COOKIE),
      readBody<SessionBody>(first).csrfToken,
    );

    const afterEnrollment = await server()
      .get('/account/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(readBody<ErrorBody>(afterEnrollment).code).toBe('MFA_REQUIRED');
  });

  it('recusa bearer de conta desativada mesmo com token válido', async () => {
    const user = await createProfessional();
    const token = legacyToken(user);

    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    const response = await server()
      .get('/account/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(readBody<ErrorBody>(response).code).toBeDefined();
  });

  it('marca a requisição por bearer como não baseada em sessão', async () => {
    const user = await createProfessional();

    const response = await server()
      .get('/account/me')
      .set('Authorization', `Bearer ${legacyToken(user)}`)
      .expect(200);

    const account = readBody<AccountBody>(response);
    expect(account.security.sessionBased).toBe(false);
    expect(JSON.stringify(account)).not.toContain('password');
  });
});
