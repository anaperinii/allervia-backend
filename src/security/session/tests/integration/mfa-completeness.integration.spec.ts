import { INestApplication } from '@nestjs/common';
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
  generateOpaqueSecret,
  hashOpaqueSecret,
} from 'src/security/session/session.crypto';
import {
  findCookie,
  joinCookies,
  readBody,
  type CsrfBody,
  type EnrollmentBody,
  type ErrorBody,
  type MfaChallengeBody,
  type MfaFactorsBody,
  type ReauthenticationBody,
  type SessionBody,
} from 'test/support/http';

const PASSWORD = 'Senha!Forte#2026';
const ORIGIN = 'http://127.0.0.1';
const SESSION_COOKIE = 'allervia_session_v2';
const PERIOD_SECONDS = 30;
const RATE_LIMIT_WINDOW_MS = 15 * 60_000;
const REAUTH_MAX_AGE_MS = 5 * 60_000;

describe('Cobertura completa de MFA e reautenticação - Integração HTTP', () => {
  let app: INestApplication<App>;
  let module: TestingModule;
  let prisma: PrismaService;
  let factories: TestFactories;

  beforeAll(async () => {
    process.env.AUTH_INSECURE_COOKIES = 'true';
    process.env.AUTH_MFA_ENFORCEMENT = 'optional';
    process.env.AUTH_ALLOWED_ORIGINS = ORIGIN;
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString('base64');

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
    process.env.AUTH_MFA_ENFORCEMENT = 'optional';
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

  async function verify(challengeToken: string, code: string) {
    const challenge = await preAuth();
    return server()
      .post('/auth/mfa/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', challenge.cookie)
      .set('X-CSRF-Token', challenge.csrfToken)
      .send({ challengeToken, code });
  }

  function totpCode(secret: string, stepsAhead = 0): string {
    return generateSync({
      secret,
      period: PERIOD_SECONDS,
      epoch: Math.floor(Date.now() / 1000) + stepsAhead * PERIOD_SECONDS,
    });
  }

  function sessionHeaders(session: {
    cookie: string;
    csrfToken: string;
    sessionId: string;
  }) {
    return {
      Cookie: session.cookie,
      Origin: ORIGIN,
      'X-CSRF-Token': session.csrfToken,
      'X-Session-Context': session.sessionId,
    };
  }

  async function loginSession(email: string) {
    const response = await login(email);
    const body = readBody<SessionBody>(response);
    return {
      cookie: findCookie(response, SESSION_COOKIE),
      csrfToken: body.csrfToken,
      sessionId: body.session.id,
    };
  }

  async function reauthenticate(session: {
    cookie: string;
    csrfToken: string;
    sessionId: string;
  }): Promise<void> {
    await server()
      .post('/auth/reauthenticate')
      .set(sessionHeaders(session))
      .send({ password: PASSWORD })
      .expect(200);
  }

  async function startEnrollment(session: {
    cookie: string;
    csrfToken: string;
    sessionId: string;
  }): Promise<EnrollmentBody> {
    await reauthenticate(session);
    const enrollment = await server()
      .post('/auth/mfa/enroll')
      .set(sessionHeaders(session))
      .send({})
      .expect(201);
    return readBody<EnrollmentBody>(enrollment);
  }

  async function confirmEnrollment(
    session: { cookie: string; csrfToken: string; sessionId: string },
    credentialId: string,
    code: string,
  ) {
    const confirmation = await server()
      .post('/auth/mfa/enroll/confirm')
      .set(sessionHeaders(session))
      .send({ credentialId, code })
      .expect(200);
    return {
      cookie: findCookie(confirmation, SESSION_COOKIE),
      body: readBody<{ recoveryCodes: string[] }>(confirmation),
    };
  }

  it('mantém o login direto quando o cadastro do segundo fator é interrompido', async () => {
    const user = await createProfessional();
    const session = await loginSession(user.email);
    const started = await startEnrollment(session);

    const again = await login(user.email);
    const body = readBody<SessionBody>(again);
    expect(body.authenticated).toBe(true);
    expect(body.session.mfaVerified).toBe(false);
    expect(findCookie(again, SESSION_COOKIE)).toEqual(expect.any(String));

    const factors = await server()
      .get('/auth/mfa/factors')
      .set('Cookie', session.cookie)
      .expect(200);
    const listed = readBody<MfaFactorsBody>(factors);
    expect(listed.factors).toEqual([
      expect.objectContaining({ id: started.credentialId, confirmed: false }),
    ]);
  });

  it('limita as tentativas de verificação do segundo fator e volta a aceitar após a janela', async () => {
    const user = await createProfessional();
    const session = await loginSession(user.email);
    const started = await startEnrollment(session);
    await confirmEnrollment(
      session,
      started.credentialId,
      totpCode(started.secret),
    );

    const first = await login(user.email);
    const firstToken = readBody<MfaChallengeBody>(first).challengeToken;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const rejected = await verify(firstToken, '000000');
      expect(rejected.status).toBe(401);
      expect(readBody<ErrorBody>(rejected).code).toBe('MFA_CODE_INVALID');
    }
    const exhausted = await verify(firstToken, '000000');
    expect(exhausted.status).toBe(401);
    expect(readBody<ErrorBody>(exhausted).code).toBe('MFA_CHALLENGE_INVALID');

    const second = await login(user.email);
    const secondToken = readBody<MfaChallengeBody>(second).challengeToken;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const rejected = await verify(secondToken, '000000');
      expect(rejected.status).toBe(401);
      expect(readBody<ErrorBody>(rejected).code).toBe('MFA_CODE_INVALID');
    }

    const limited = await verify(secondToken, totpCode(started.secret, 1));
    expect(limited.status).toBe(429);
    expect(readBody<ErrorBody>(limited).code).toBe('TOO_MANY_ATTEMPTS');

    await prisma.authAttempt.updateMany({
      where: { operation: 'mfa-verify' },
      data: {
        occurredAt: new Date(Date.now() - RATE_LIMIT_WINDOW_MS - 60_000),
      },
    });

    const third = await login(user.email);
    const accepted = await verify(
      readBody<MfaChallengeBody>(third).challengeToken,
      totpCode(started.secret, 1),
    );
    expect(accepted.status).toBe(200);
  });

  it('rejeita códigos TOTP fora da janela de tolerância temporal', async () => {
    const user = await createProfessional();
    const session = await loginSession(user.email);
    const started = await startEnrollment(session);
    await confirmEnrollment(
      session,
      started.credentialId,
      totpCode(started.secret),
    );

    const challenged = await login(user.email);
    const challengeToken =
      readBody<MfaChallengeBody>(challenged).challengeToken;

    const past = await verify(challengeToken, totpCode(started.secret, -3));
    expect(past.status).toBe(401);
    expect(readBody<ErrorBody>(past).code).toBe('MFA_CODE_INVALID');

    const future = await verify(challengeToken, totpCode(started.secret, 3));
    expect(future.status).toBe(401);
    expect(readBody<ErrorBody>(future).code).toBe('MFA_CODE_INVALID');

    const accepted = await verify(challengeToken, totpCode(started.secret, 1));
    expect(accepted.status).toBe(200);
  });

  it('rejeita o desafio expirado com código estável', async () => {
    const user = await createProfessional();
    const session = await loginSession(user.email);
    const started = await startEnrollment(session);
    await confirmEnrollment(
      session,
      started.credentialId,
      totpCode(started.secret),
    );

    const challenged = await login(user.email);
    const challengeToken =
      readBody<MfaChallengeBody>(challenged).challengeToken;

    await prisma.preAuthChallenge.updateMany({
      where: { consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const expired = await verify(challengeToken, totpCode(started.secret, 1));
    expect(expired.status).toBe(401);
    expect(readBody<ErrorBody>(expired).code).toBe('MFA_CHALLENGE_INVALID');
  });

  it('não aceita o mesmo código TOTP em dois desafios consecutivos', async () => {
    const user = await createProfessional();
    const session = await loginSession(user.email);
    const started = await startEnrollment(session);
    await confirmEnrollment(
      session,
      started.credentialId,
      totpCode(started.secret),
    );

    const code = totpCode(started.secret, 1);

    const first = await login(user.email);
    const accepted = await verify(
      readBody<MfaChallengeBody>(first).challengeToken,
      code,
    );
    expect(accepted.status).toBe(200);

    const second = await login(user.email);
    const replayed = await verify(
      readBody<MfaChallengeBody>(second).challengeToken,
      code,
    );
    expect(replayed.status).toBe(401);
    expect(readBody<ErrorBody>(replayed).code).toBe('MFA_CODE_INVALID');
  });

  it('AC-11: cadastrar fator em sessão autenticada exige reautenticação recente', async () => {
    const user = await createProfessional();
    const session = await loginSession(user.email);

    const blockedEnroll = await server()
      .post('/auth/mfa/enroll')
      .set(sessionHeaders(session))
      .send({});
    expect(blockedEnroll.status).toBe(403);
    expect(readBody<ErrorBody>(blockedEnroll).code).toBe(
      'REAUTHENTICATION_REQUIRED',
    );

    await reauthenticate(session);
    const enrollment = await server()
      .post('/auth/mfa/enroll')
      .set(sessionHeaders(session))
      .send({})
      .expect(201);
    const started = readBody<EnrollmentBody>(enrollment);
    expect(started.secret).toEqual(expect.any(String));
  });

  it('remove o fator somente com reautenticação recente e volta ao login sem segundo fator', async () => {
    const user = await createProfessional();
    const session = await loginSession(user.email);
    const started = await startEnrollment(session);
    const confirmed = await confirmEnrollment(
      session,
      started.credentialId,
      totpCode(started.secret),
    );

    const relogin = await login(user.email);
    const challenge = readBody<MfaChallengeBody>(relogin);
    const verified = await verify(
      challenge.challengeToken,
      confirmed.body.recoveryCodes[0],
    );
    expect(verified.status).toBe(200);
    const fresh = {
      cookie: findCookie(verified, SESSION_COOKIE),
      csrfToken: readBody<SessionBody>(verified).csrfToken,
      sessionId: readBody<SessionBody>(verified).session.id,
    };

    const blocked = await server()
      .delete(`/auth/mfa/factors/${started.credentialId}`)
      .set(sessionHeaders(fresh))
      .send({});
    expect(blocked.status).toBe(403);
    expect(readBody<ErrorBody>(blocked).code).toBe('REAUTHENTICATION_REQUIRED');

    await server()
      .post('/auth/reauthenticate')
      .set(sessionHeaders(fresh))
      .send({ password: PASSWORD, code: totpCode(started.secret, 1) })
      .expect(200);

    await server()
      .delete(`/auth/mfa/factors/${started.credentialId}`)
      .set(sessionHeaders(fresh))
      .send({})
      .expect(204);

    const again = await login(user.email);
    expect(readBody<SessionBody>(again).authenticated).toBe(true);
    expect(findCookie(again, SESSION_COOKIE)).toEqual(expect.any(String));
  });

  it('não emite sessão clínica antes do segundo fator quando a política é obrigatória', async () => {
    process.env.AUTH_MFA_ENFORCEMENT = 'required';
    const user = await createProfessional();

    const first = await login(user.email);
    const firstChallenge = readBody<MfaChallengeBody>(first);
    expect(firstChallenge.status).toBe('MFA_ENROLLMENT_REQUIRED');
    expect(firstChallenge.enrollment?.secret).toEqual(expect.any(String));
    expect(first.headers['set-cookie']).toBeUndefined();

    const second = await login(user.email);
    const secondChallenge = readBody<MfaChallengeBody>(second);
    expect(secondChallenge.enrollment?.credentialId).not.toBe(
      firstChallenge.enrollment?.credentialId,
    );

    const abandonedSecret = await verify(
      secondChallenge.challengeToken,
      totpCode(firstChallenge.enrollment!.secret),
    );
    expect(abandonedSecret.status).toBe(401);
    expect(readBody<ErrorBody>(abandonedSecret).code).toBe('MFA_CODE_INVALID');

    const completed = await verify(
      secondChallenge.challengeToken,
      totpCode(secondChallenge.enrollment!.secret),
    );
    expect(completed.status).toBe(200);
    await server()
      .get('/patients')
      .set('Cookie', findCookie(completed, SESSION_COOKIE))
      .expect(200);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    const forgedSecret = generateOpaqueSecret();
    await prisma.authSession.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        secretHash: hashOpaqueSecret(forgedSecret),
        authVersion: stored.tokenVersion,
        expiresAt: new Date(Date.now() + 3_600_000),
        mfaVerifiedAt: null,
      },
    });

    const preMfa = await server()
      .get('/patients')
      .set('Cookie', `${SESSION_COOKIE}=${forgedSecret}`);
    expect(preMfa.status).toBe(403);
    expect(readBody<ErrorBody>(preMfa).code).toBe('MFA_REQUIRED');
  });

  it('atualiza reauthenticatedAt e expira a janela de reautenticação', async () => {
    const user = await createProfessional();
    const session = await loginSession(user.email);
    const factorA = await startEnrollment(session);
    const factorB = await startEnrollment(session);

    const wrongPassword = await server()
      .post('/auth/reauthenticate')
      .set(sessionHeaders(session))
      .send({ password: 'Senha!Errada#2026' });
    expect(wrongPassword.status).toBe(401);
    expect(readBody<ErrorBody>(wrongPassword).code).toBe('INVALID_CREDENTIALS');

    const reauth = await server()
      .post('/auth/reauthenticate')
      .set(sessionHeaders(session))
      .send({ password: PASSWORD })
      .expect(200);
    const reauthBody = readBody<ReauthenticationBody>(reauth);
    expect(reauthBody.reauthenticatedAt).toEqual(expect.any(String));
    expect(reauthBody.maxAgeSeconds).toBe(REAUTH_MAX_AGE_MS / 1000);

    const envelope = await server()
      .get('/auth/session')
      .set('Cookie', session.cookie)
      .expect(200);
    expect(readBody<SessionBody>(envelope).session.reauthenticatedAt).toBe(
      reauthBody.reauthenticatedAt,
    );

    await server()
      .delete(`/auth/mfa/factors/${factorA.credentialId}`)
      .set(sessionHeaders(session))
      .send({})
      .expect(204);

    await prisma.authSession.update({
      where: { id: session.sessionId },
      data: {
        reauthenticatedAt: new Date(Date.now() - REAUTH_MAX_AGE_MS - 60_000),
      },
    });

    const stale = await server()
      .delete(`/auth/mfa/factors/${factorB.credentialId}`)
      .set(sessionHeaders(session))
      .send({});
    expect(stale.status).toBe(403);
    expect(readBody<ErrorBody>(stale).code).toBe('REAUTHENTICATION_REQUIRED');
  });

  it('nunca expõe o segredo TOTP depois da resposta de cadastro', async () => {
    const user = await createProfessional();
    const session = await loginSession(user.email);
    const started = await startEnrollment(session);
    expect(started.secret).toEqual(expect.any(String));
    expect(started.keyUri).toContain('otpauth://');

    const beforeConfirm = await server()
      .get('/auth/mfa/factors')
      .set('Cookie', session.cookie)
      .expect(200);
    expect(JSON.stringify(beforeConfirm.body)).not.toContain(started.secret);
    expect(
      readBody<MfaFactorsBody>(beforeConfirm).factors.map((factor) =>
        Object.keys(factor).sort(),
      ),
    ).toEqual([['confirmed', 'id', 'label']]);

    const confirmed = await confirmEnrollment(
      session,
      started.credentialId,
      totpCode(started.secret),
    );
    expect(JSON.stringify(confirmed.body)).not.toContain(started.secret);

    const afterConfirm = await server()
      .get('/auth/mfa/factors')
      .set('Cookie', confirmed.cookie)
      .expect(200);
    expect(JSON.stringify(afterConfirm.body)).not.toContain(started.secret);
    expect(JSON.stringify(afterConfirm.body)).not.toContain('keyUri');
    expect(JSON.stringify(afterConfirm.body)).not.toContain('iphertext');

    const envelope = await server()
      .get('/auth/session')
      .set('Cookie', confirmed.cookie)
      .expect(200);
    expect(JSON.stringify(envelope.body)).not.toContain(started.secret);
  });
});
