import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { hash } from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { buildValidationPipe } from 'src/infra/http/validation-pipe';
import { IEmailService } from 'src/infra/email/email.service';
import { SecurityUtil } from 'src/utils/security.utils';
import { AUTH_MESSAGES } from 'src/security/auth.messages';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import {
  findCookie,
  joinCookies,
  readBody,
  type CsrfBody,
  type ErrorBody,
  type SessionBody,
} from 'test/support/http';

const PASSWORD = 'Senha!Forte#2026';
const NEW_PASSWORD = 'NovaSenha!Forte#2027';
const ORIGIN = 'http://127.0.0.1';
const SESSION_COOKIE = 'allervia_session_v2';

interface ResetMessageBody {
  message: string;
}

interface ResetVerifyBody {
  valid: boolean;
}

describe('Recuperação de senha - Integração HTTP', () => {
  let app: INestApplication<App>;
  let module: TestingModule;
  let prisma: PrismaService;
  let factories: TestFactories;
  const resetEmails: Array<{ email: string; token: string }> = [];
  const changedNotifications: string[] = [];

  beforeAll(async () => {
    process.env.AUTH_INSECURE_COOKIES = 'true';
    process.env.AUTH_MFA_ENFORCEMENT = 'optional';
    process.env.AUTH_ALLOWED_ORIGINS = ORIGIN;

    await TestDatabaseManager.connect();

    const emailSpy: IEmailService = {
      sendPasswordResetLink: (email: string, token: string) => {
        resetEmails.push({ email, token });
        return Promise.resolve();
      },
      sendPasswordChangedNotification: (email: string) => {
        changedNotifications.push(email);
        return Promise.resolve();
      },
      sendDemoRequest: () => Promise.resolve(),
      sendInviteLink: () => Promise.resolve(),
    };

    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .overrideProvider(IEmailService)
      .useValue(emailSpy)
      .compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(buildValidationPipe());
    await app.init();

    prisma = module.get(PrismaService);
    factories = new TestFactories(prisma);
  });

  beforeEach(async () => {
    resetEmails.length = 0;
    changedNotifications.length = 0;
    await TestDatabaseManager.cleanAll();
  });

  afterAll(async () => {
    if (app) await app.close();
    await TestDatabaseManager.disconnect();
  });

  const server = () => request(app.getHttpServer());

  async function preAuth(): Promise<{ cookie: string; csrfToken: string }> {
    const challenge = await server().get('/auth/csrf').expect(200);
    return {
      cookie: joinCookies(challenge),
      csrfToken: readBody<CsrfBody>(challenge).csrfToken,
    };
  }

  async function postPublic(path: string, body: Record<string, string>) {
    const challenge = await preAuth();
    return server()
      .post(path)
      .set('Origin', ORIGIN)
      .set('Cookie', challenge.cookie)
      .set('X-CSRF-Token', challenge.csrfToken)
      .send(body);
  }

  async function login(email: string, password: string) {
    const challenge = await preAuth();
    const response = await server()
      .post('/auth/sessions')
      .set('Origin', ORIGIN)
      .set('Cookie', challenge.cookie)
      .set('X-CSRF-Token', challenge.csrfToken)
      .send({ email, password })
      .expect(200);
    return {
      cookie: findCookie(response, SESSION_COOKIE),
      sessionId: readBody<SessionBody>(response).session.id,
    };
  }

  async function createUser() {
    return factories.users.createAuthenticatedPhysicianProfessional({
      password: await hash(PASSWORD, 10),
    });
  }

  async function requestReset(email: string) {
    const response = await postPublic('/auth/password-reset/request', {
      email,
    });
    expect(response.status).toBe(202);
    return response;
  }

  async function expireToken(token: string) {
    await prisma.verificationToken.updateMany({
      where: { tokenHash: SecurityUtil.sha256(token) },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
  }

  it('fluxo feliz: redefine a senha, revoga sessões antigas e aceita apenas a senha nova', async () => {
    const user = await createUser();
    const oldSession = await login(user.email, PASSWORD);

    await requestReset(user.email);
    expect(resetEmails).toHaveLength(1);
    expect(resetEmails[0].email).toBe(user.email);
    const token = resetEmails[0].token;
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const verify = await postPublic('/auth/password-reset/verify', { token });
    expect(verify.status).toBe(200);
    expect(readBody<ResetVerifyBody>(verify)).toEqual({ valid: true });

    const confirm = await postPublic('/auth/password-reset/confirm', {
      token,
      newPassword: NEW_PASSWORD,
    });
    expect(confirm.status).toBe(200);
    expect(readBody<ResetMessageBody>(confirm).message).toBe(
      'Senha redefinida com sucesso.',
    );
    expect(changedNotifications).toEqual([user.email]);

    await server()
      .get('/account/me')
      .set('Cookie', oldSession.cookie)
      .expect(401);
    const revoked = await prisma.authSession.findUniqueOrThrow({
      where: { id: oldSession.sessionId },
    });
    expect(revoked.revokedReason).toBe('PASSWORD_CHANGED');

    const oldPasswordAttempt = await postPublic('/auth/sessions', {
      email: user.email,
      password: PASSWORD,
    });
    expect(oldPasswordAttempt.status).toBe(401);
    expect(readBody<ErrorBody>(oldPasswordAttempt).code).toBe(
      'INVALID_CREDENTIALS',
    );

    const newSession = await login(user.email, NEW_PASSWORD);
    await server()
      .get('/account/me')
      .set('Cookie', newSession.cookie)
      .expect(200);
  });

  it('rejeita token inexistente na verificação e na confirmação', async () => {
    const bogus = SecurityUtil.generateSecureToken();

    const verify = await postPublic('/auth/password-reset/verify', {
      token: bogus,
    });
    expect(verify.status).toBe(404);
    expect(readBody<ErrorBody>(verify).code).toBe('NOT_FOUND');
    expect(readBody<ErrorBody>(verify).message).toBe(
      AUTH_MESSAGES.invalidOrExpiredResetToken,
    );

    const confirm = await postPublic('/auth/password-reset/confirm', {
      token: bogus,
      newPassword: NEW_PASSWORD,
    });
    expect(confirm.status).toBe(404);
    expect(readBody<ErrorBody>(confirm).code).toBe('NOT_FOUND');
  });

  it('rejeita token expirado na verificação e na confirmação', async () => {
    const user = await createUser();
    await requestReset(user.email);
    const token = resetEmails[0].token;
    await expireToken(token);

    const verify = await postPublic('/auth/password-reset/verify', { token });
    expect(verify.status).toBe(404);
    expect(readBody<ErrorBody>(verify).code).toBe('NOT_FOUND');

    const confirm = await postPublic('/auth/password-reset/confirm', {
      token,
      newPassword: NEW_PASSWORD,
    });
    expect(confirm.status).toBe(404);
    expect(readBody<ErrorBody>(confirm).code).toBe('NOT_FOUND');

    const stillOldPassword = await login(user.email, PASSWORD);
    expect(stillOldPassword.cookie).toContain(SESSION_COOKIE);
  });

  it('token é de uso único: segunda confirmação falha', async () => {
    const user = await createUser();
    await requestReset(user.email);
    const token = resetEmails[0].token;

    const first = await postPublic('/auth/password-reset/confirm', {
      token,
      newPassword: NEW_PASSWORD,
    });
    expect(first.status).toBe(200);

    const second = await postPublic('/auth/password-reset/confirm', {
      token,
      newPassword: 'OutraSenha!Forte#2028',
    });
    expect(second.status).toBe(404);
    expect(readBody<ErrorBody>(second).code).toBe('NOT_FOUND');

    const session = await login(user.email, NEW_PASSWORD);
    expect(session.cookie).toContain(SESSION_COOKIE);
  });

  it('responde 202 para email inexistente sem enviar email nem criar token', async () => {
    const response = await requestReset('ninguem@clinica.com.br');
    expect(readBody<ResetMessageBody>(response).message).toBe(
      'Se o e-mail existir, enviamos as instruções de redefinição.',
    );
    expect(resetEmails).toHaveLength(0);
    expect(await prisma.verificationToken.count()).toBe(0);
  });

  it('segunda solicitação dentro de um minuto responde 202 sem emitir novo token nem email', async () => {
    const user = await createUser();
    await requestReset(user.email);
    const second = await requestReset(user.email);

    expect(readBody<ResetMessageBody>(second).message).toBe(
      'Se o e-mail existir, enviamos as instruções de redefinição.',
    );
    expect(resetEmails).toHaveLength(1);
    expect(
      await prisma.verificationToken.count({
        where: { userId: user.id, purpose: 'PASSWORD_RESET' },
      }),
    ).toBe(1);
  });

  it('nunca expõe o token no corpo das respostas', async () => {
    const user = await createUser();
    const requested = await requestReset(user.email);
    const token = resetEmails[0].token;
    expect(JSON.stringify(requested.body)).not.toContain(token);

    const verify = await postPublic('/auth/password-reset/verify', { token });
    expect(verify.status).toBe(200);
    expect(JSON.stringify(verify.body)).not.toContain(token);

    const confirm = await postPublic('/auth/password-reset/confirm', {
      token,
      newPassword: NEW_PASSWORD,
    });
    expect(confirm.status).toBe(200);
    expect(JSON.stringify(confirm.body)).not.toContain(token);

    const stored = await prisma.verificationToken.findFirstOrThrow({
      where: { userId: user.id, purpose: 'PASSWORD_RESET' },
    });
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toBe(SecurityUtil.sha256(token));
  });
});
