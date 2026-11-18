import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { hash } from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { buildValidationPipe } from 'src/infra/http/validation-pipe';
import {
  IEmailService,
  type EmailChangeLinkParams,
} from 'src/infra/email/email.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { SecurityUtil } from 'src/utils/security.utils';
import { AUTH_MESSAGES } from 'src/security/auth.messages';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
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
const ORIGIN = 'http://127.0.0.1';
const SESSION_COOKIE = 'allervia_session_v2';
const NEW_EMAIL = 'novo.endereco@clinica.com.br';

interface EmailChangeRequestBody {
  id: string;
  professionalId: string;
  professionalName: string;
  currentEmail: string;
  newEmail: string;
  status:
    | 'PENDING'
    | 'DISPATCHED'
    | 'CONFIRMED'
    | 'REJECTED'
    | 'SUPERSEDED'
    | 'EXPIRED';
  expiresAt: string;
  requestedAt: string;
  decidedAt?: string | null;
  whatsappUrl?: string;
}

interface EmailChangeVerifyBody {
  valid: boolean;
  newEmail: string;
}

interface EmailChangeMessageBody {
  message: string;
}

interface EmailChangePageBody {
  items: EmailChangeRequestBody[];
  total: number;
  pending: number;
}

interface AuthenticatedSession {
  cookie: string;
  csrfToken: string;
  sessionId: string;
}

describe('Troca de e-mail (ADR 008) - Integração HTTP', () => {
  let app: INestApplication<App>;
  let module: TestingModule;
  let prisma: PrismaService;
  let factories: TestFactories;
  let notifications: NotificationsService;

  const changeLinks: EmailChangeLinkParams[] = [];
  const farewells: Array<{ previousEmail: string; newEmail: string }> = [];
  const welcomes: string[] = [];

  beforeAll(async () => {
    process.env.AUTH_INSECURE_COOKIES = 'true';
    process.env.AUTH_MFA_ENFORCEMENT = 'optional';
    process.env.AUTH_ALLOWED_ORIGINS = ORIGIN;

    await TestDatabaseManager.connect();

    const emailSpy: IEmailService = {
      sendEmailChangeLink: (params: EmailChangeLinkParams) => {
        changeLinks.push(params);
        return Promise.resolve();
      },
      sendEmailChangeFarewell: (previousEmail: string, newEmail: string) => {
        farewells.push({ previousEmail, newEmail });
        return Promise.resolve();
      },
      sendEmailChangeWelcome: (newEmail: string) => {
        welcomes.push(newEmail);
        return Promise.resolve();
      },
      sendPasswordResetLink: () => Promise.resolve(),
      sendPasswordChangedNotification: () => Promise.resolve(),
      sendDemoRequest: () => Promise.resolve(),
      sendDemoRequestConfirmation: () => Promise.resolve(),
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
    notifications = module.get(NotificationsService);
    factories = new TestFactories(prisma);
  });

  beforeEach(async () => {
    changeLinks.length = 0;
    farewells.length = 0;
    welcomes.length = 0;
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

  async function postPublic(path: string, body: Record<string, unknown>) {
    const challenge = await preAuth();
    return server()
      .post(path)
      .set('Origin', ORIGIN)
      .set('Cookie', challenge.cookie)
      .set('X-CSRF-Token', challenge.csrfToken)
      .send(body);
  }

  async function login(email: string): Promise<AuthenticatedSession> {
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

  function headers(session: AuthenticatedSession) {
    return {
      Cookie: session.cookie,
      Origin: ORIGIN,
      'X-CSRF-Token': session.csrfToken,
      'X-Session-Context': session.sessionId,
    };
  }

  async function reauthenticate(session: AuthenticatedSession): Promise<void> {
    await server()
      .post('/auth/reauthenticate')
      .set(headers(session))
      .send({ password: PASSWORD })
      .expect(200);
  }

  async function createClinic(): Promise<{
    admin: AuthenticatedUserPayload;
    member: AuthenticatedUserPayload;
  }> {
    const password = await hash(PASSWORD, 10);
    const admin = await factories.users.createAuthenticatedAdmin({ password });
    const member = await factories.users.createColleagueWithRoles(
      admin.organizationId,
      ['PHYSICIAN'],
      { password },
    );
    return { admin, member };
  }

  async function adminRequest(
    session: AuthenticatedSession,
    professionalId: string,
    body: Record<string, unknown>,
  ) {
    return server()
      .post(`/professionals/${professionalId}/email-change`)
      .set(headers(session))
      .send(body);
  }

  async function selfRequest(
    session: AuthenticatedSession,
    body: Record<string, unknown>,
  ) {
    await reauthenticate(session);
    return server()
      .post('/account/me/email-change')
      .set(headers(session))
      .send(body);
  }

  it('caminho admin: dispara já aprovado, confirma e troca o login', async () => {
    const { admin, member } = await createClinic();
    const adminSession = await login(admin.email);
    const memberSession = await login(member.email);

    const requested = await adminRequest(
      adminSession,
      member.professionalId as string,
      { newEmail: NEW_EMAIL, channel: 'email' },
    );
    expect(requested.status).toBe(202);
    const requestBody = readBody<EmailChangeRequestBody>(requested);
    expect(requestBody.status).toBe('DISPATCHED');
    expect(requestBody.newEmail).toBe(NEW_EMAIL);
    expect(requestBody.whatsappUrl).toBeUndefined();

    expect(changeLinks).toHaveLength(1);
    const token = changeLinks[0].token;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(requested.body)).not.toContain(token);

    const verify = await postPublic('/auth/email-change/verify', { token });
    expect(verify.status).toBe(200);
    expect(readBody<EmailChangeVerifyBody>(verify)).toEqual({
      valid: true,
      newEmail: NEW_EMAIL,
    });

    const confirm = await postPublic('/auth/email-change/confirm', { token });
    expect(confirm.status).toBe(200);
    expect(readBody<EmailChangeMessageBody>(confirm).message).toContain(
      NEW_EMAIL,
    );

    expect(farewells).toEqual([
      { previousEmail: member.email, newEmail: NEW_EMAIL },
    ]);
    expect(welcomes).toEqual([NEW_EMAIL]);

    await server()
      .get('/account/me')
      .set('Cookie', memberSession.cookie)
      .expect(401);
    const revoked = await prisma.authSession.findUniqueOrThrow({
      where: { id: memberSession.sessionId },
    });
    expect(revoked.revokedReason).toBe('EMAIL_CHANGED');

    const oldEmailAttempt = await postPublic('/auth/sessions', {
      email: member.email,
      password: PASSWORD,
    });
    expect(oldEmailAttempt.status).toBe(401);
    expect(readBody<ErrorBody>(oldEmailAttempt).code).toBe(
      'INVALID_CREDENTIALS',
    );

    const newSession = await login(NEW_EMAIL);
    await server()
      .get('/account/me')
      .set('Cookie', newSession.cookie)
      .expect(200);

    const audit = await prisma.auditLog.findMany({
      where: { entityId: member.id },
      orderBy: { timestamp: 'asc' },
    });
    expect(audit.map((entry) => entry.action)).toEqual(
      expect.arrayContaining([
        'EMAIL_CHANGE_REQUESTED',
        'EMAIL_CHANGE_CONFIRMED',
      ]),
    );
  });

  it('caminho admin com canal whatsapp devolve URL wa.me e não envia e-mail', async () => {
    const { admin, member } = await createClinic();
    await prisma.professional.update({
      where: { id: member.professionalId as string },
      data: { phoneNumber: '(11) 98888-7777' },
    });
    const adminSession = await login(admin.email);

    const requested = await adminRequest(
      adminSession,
      member.professionalId as string,
      { newEmail: NEW_EMAIL, channel: 'whatsapp' },
    );
    expect(requested.status).toBe(202);

    const body = readBody<EmailChangeRequestBody>(requested);
    expect(changeLinks).toHaveLength(0);
    expect(body.whatsappUrl).toMatch(/^https:\/\/wa\.me\/5511988887777\?text=/);
    expect(decodeURIComponent(body.whatsappUrl as string)).toContain(
      '/confirm-email-change?token=',
    );
  });

  it('caminho self-service: nasce pendente, admin aprova com TTL novo e confirma', async () => {
    const { admin, member } = await createClinic();
    const adminSession = await login(admin.email);
    const memberSession = await login(member.email);

    const requested = await selfRequest(memberSession, { newEmail: NEW_EMAIL });
    expect(requested.status).toBe(202);
    const pending = readBody<EmailChangeRequestBody>(requested);
    expect(pending.status).toBe('PENDING');
    expect(changeLinks).toHaveLength(0);

    const pendingTtlMs = new Date(pending.expiresAt).getTime() - Date.now();
    expect(pendingTtlMs).toBeGreaterThan(6 * 24 * 60 * 60_000);

    await notifications.processPending();
    const adminNotifications = await prisma.notification.findMany({
      where: { userId: admin.id, kind: 'EMAIL_CHANGE_REQUEST_PENDING' },
    });
    expect(adminNotifications).toHaveLength(1);

    const list = await server()
      .get('/professionals/email-change-requests')
      .set(headers(adminSession))
      .expect(200);
    const page = readBody<EmailChangePageBody>(list);
    expect(page.total).toBe(1);
    expect(page.items[0].id).toBe(pending.id);
    expect(page.items[0].newEmail).toBe(NEW_EMAIL);

    const approved = await server()
      .post(`/professionals/email-change-requests/${pending.id}/approve`)
      .set(headers(adminSession))
      .send({ channel: 'email' })
      .expect(200);
    const approvedBody = readBody<EmailChangeRequestBody>(approved);
    expect(approvedBody.status).toBe('DISPATCHED');

    const confirmationTtlMs =
      new Date(approvedBody.expiresAt).getTime() - Date.now();
    expect(confirmationTtlMs).toBeLessThanOrEqual(61 * 60_000);
    expect(confirmationTtlMs).toBeGreaterThan(55 * 60_000);

    const stored = await prisma.verificationToken.findUniqueOrThrow({
      where: { id: pending.id },
    });
    expect(stored.approvedAt).not.toBeNull();
    expect(stored.approvedById).toBe(admin.id);
    expect(stored.requestedById).toBe(member.id);

    expect(changeLinks).toHaveLength(1);
    const token = changeLinks[0].token;

    const confirm = await postPublic('/auth/email-change/confirm', { token });
    expect(confirm.status).toBe(200);

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: member.id },
    });
    expect(updated.email).toBe(NEW_EMAIL);

    const historyList = await server()
      .get('/professionals/email-change-requests')
      .set(headers(adminSession))
      .expect(200);
    const history = readBody<EmailChangePageBody>(historyList);
    expect(history.total).toBe(1);
    expect(history.pending).toBe(0);
    expect(history.items[0].id).toBe(pending.id);
    expect(history.items[0].status).toBe('CONFIRMED');
    expect(history.items[0].decidedAt).not.toBeNull();
  });

  it('recusa consome o pedido, notifica o profissional e não altera o e-mail', async () => {
    const { admin, member } = await createClinic();
    const adminSession = await login(admin.email);
    const memberSession = await login(member.email);

    const requested = await selfRequest(memberSession, { newEmail: NEW_EMAIL });
    const pending = readBody<EmailChangeRequestBody>(requested);

    const rejected = await server()
      .post(`/professionals/email-change-requests/${pending.id}/reject`)
      .set(headers(adminSession))
      .send({})
      .expect(200);
    expect(readBody<EmailChangeRequestBody>(rejected).status).toBe('REJECTED');

    const stored = await prisma.verificationToken.findUniqueOrThrow({
      where: { id: pending.id },
    });
    expect(stored.consumedAt).not.toBeNull();
    expect(stored.approvedAt).toBeNull();
    expect(stored.rejectedAt).not.toBeNull();
    expect(stored.rejectedById).toBe(admin.id);

    const history = readBody<EmailChangePageBody>(
      await server()
        .get('/professionals/email-change-requests')
        .set(headers(adminSession))
        .expect(200),
    );
    expect(history.total).toBe(1);
    expect(history.pending).toBe(0);
    expect(history.items[0].status).toBe('REJECTED');

    await notifications.processPending();
    const memberNotifications = await prisma.notification.findMany({
      where: { userId: member.id, kind: 'EMAIL_CHANGE_REQUEST_DECIDED' },
    });
    expect(memberNotifications).toHaveLength(1);
    expect(memberNotifications[0].body).toContain('recusado');

    const unchanged = await prisma.user.findUniqueOrThrow({
      where: { id: member.id },
    });
    expect(unchanged.email).toBe(member.email);

    const second = await server()
      .post(`/professionals/email-change-requests/${pending.id}/reject`)
      .set(headers(adminSession))
      .send({})
      .expect(404);
    expect(readBody<ErrorBody>(second).code).toBe('NOT_FOUND');
  });

  it('recusa e-mail já usado por outra conta com 409 EMAIL_ALREADY_IN_USE', async () => {
    const { admin, member } = await createClinic();
    const adminSession = await login(admin.email);

    const response = await adminRequest(
      adminSession,
      member.professionalId as string,
      { newEmail: admin.email, channel: 'email' },
    );
    expect(response.status).toBe(409);
    expect(readBody<ErrorBody>(response).code).toBe('EMAIL_ALREADY_IN_USE');
    expect(changeLinks).toHaveLength(0);
  });

  it('recusa e-mail igual ao atual com 400 EMAIL_SAME_AS_CURRENT', async () => {
    const { admin, member } = await createClinic();
    const adminSession = await login(admin.email);

    const response = await adminRequest(
      adminSession,
      member.professionalId as string,
      { newEmail: member.email.toUpperCase(), channel: 'email' },
    );
    expect(response.status).toBe(400);
    expect(readBody<ErrorBody>(response).code).toBe('EMAIL_SAME_AS_CURRENT');
  });

  it('token pendente de aprovação é tratado como inexistente em verify e confirm', async () => {
    const { member } = await createClinic();
    const memberSession = await login(member.email);

    const requested = await selfRequest(memberSession, { newEmail: NEW_EMAIL });
    const pending = readBody<EmailChangeRequestBody>(requested);

    const token = SecurityUtil.generateSecureToken();
    await prisma.verificationToken.update({
      where: { id: pending.id },
      data: { tokenHash: SecurityUtil.sha256(token) },
    });

    const verify = await postPublic('/auth/email-change/verify', { token });
    expect(verify.status).toBe(404);
    expect(readBody<ErrorBody>(verify).message).toBe(
      AUTH_MESSAGES.invalidOrExpiredEmailChangeToken,
    );

    const confirm = await postPublic('/auth/email-change/confirm', { token });
    expect(confirm.status).toBe(404);
    expect(readBody<ErrorBody>(confirm).code).toBe('NOT_FOUND');

    const unchanged = await prisma.user.findUniqueOrThrow({
      where: { id: member.id },
    });
    expect(unchanged.email).toBe(member.email);
  });

  it('token inexistente, expirado e consumido devolvem sempre o mesmo 404', async () => {
    const { admin, member } = await createClinic();
    const adminSession = await login(admin.email);

    const bogus = SecurityUtil.generateSecureToken();
    const bogusVerify = await postPublic('/auth/email-change/verify', {
      token: bogus,
    });
    expect(bogusVerify.status).toBe(404);
    expect(readBody<ErrorBody>(bogusVerify).message).toBe(
      AUTH_MESSAGES.invalidOrExpiredEmailChangeToken,
    );

    await adminRequest(adminSession, member.professionalId as string, {
      newEmail: NEW_EMAIL,
      channel: 'email',
    });
    const token = changeLinks[0].token;

    await prisma.verificationToken.updateMany({
      where: { tokenHash: SecurityUtil.sha256(token) },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const expiredVerify = await postPublic('/auth/email-change/verify', {
      token,
    });
    expect(expiredVerify.status).toBe(404);
    const expiredConfirm = await postPublic('/auth/email-change/confirm', {
      token,
    });
    expect(expiredConfirm.status).toBe(404);

    await prisma.verificationToken.updateMany({
      where: { tokenHash: SecurityUtil.sha256(token) },
      data: { expiresAt: new Date(Date.now() + 60 * 60_000) },
    });

    const first = await postPublic('/auth/email-change/confirm', { token });
    expect(first.status).toBe(200);

    const second = await postPublic('/auth/email-change/confirm', { token });
    expect(second.status).toBe(404);
    expect(readBody<ErrorBody>(second).code).toBe('NOT_FOUND');
  });

  it('segunda solicitação dentro de um minuto é barrada pelo rate limit', async () => {
    const { admin, member } = await createClinic();
    const adminSession = await login(admin.email);

    const first = await adminRequest(
      adminSession,
      member.professionalId as string,
      { newEmail: NEW_EMAIL, channel: 'email' },
    );
    expect(first.status).toBe(202);

    const second = await adminRequest(
      adminSession,
      member.professionalId as string,
      { newEmail: 'outro.endereco@clinica.com.br', channel: 'email' },
    );
    expect(second.status).toBe(429);
    expect(readBody<ErrorBody>(second).code).toBe('TOO_MANY_ATTEMPTS');
    expect(changeLinks).toHaveLength(1);
  });

  it('exige reautenticação recente na rota self-service', async () => {
    const { member } = await createClinic();
    const memberSession = await login(member.email);

    const response = await server()
      .post('/account/me/email-change')
      .set(headers(memberSession))
      .send({ newEmail: NEW_EMAIL });

    expect(response.status).toBe(403);
    expect(readBody<ErrorBody>(response).code).toBe(
      'REAUTHENTICATION_REQUIRED',
    );
  });
});
