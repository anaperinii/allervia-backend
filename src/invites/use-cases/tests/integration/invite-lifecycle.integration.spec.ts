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
  InviteEmailParams,
} from 'src/infra/email/email.service';
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
const SESSION_COOKIE = 'allervia_session';

interface InviteBody {
  id: string;
  email: string;
  role: string;
  status: string;
}

interface InvitePageBody {
  items: InviteBody[];
  total: number;
  page: number;
}

interface InviteContextBody {
  email: string;
  fullName: string;
  role: string;
  organizationName: string;
}

/**
 * Ciclo do convite sobre HTTP real: emissão, contexto para quem recebe,
 * cadastro com vínculo correto e recusa de convite expirado, cancelado ou já
 * usado. O token chega apenas por e-mail.
 */
describe('Ciclo do convite - Integração HTTP', () => {
  let app: INestApplication<App>;
  let module: TestingModule;
  let prisma: PrismaService;
  let factories: TestFactories;
  const delivered: InviteEmailParams[] = [];

  beforeAll(async () => {
    process.env.AUTH_INSECURE_COOKIES = 'true';
    process.env.AUTH_MFA_ENFORCEMENT = 'optional';
    process.env.AUTH_ALLOWED_ORIGINS = ORIGIN;
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';

    await TestDatabaseManager.connect();

    // O transporte de e-mail é substituído para capturar o token entregue: ele
    // não aparece em nenhuma resposta HTTP.
    const emailSpy: IEmailService = {
      sendPasswordResetLink: () => Promise.resolve(),
      sendPasswordChangedNotification: () => Promise.resolve(),
      sendInviteLink: (params: InviteEmailParams) => {
        delivered.push(params);
        return Promise.resolve();
      },
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
    delivered.length = 0;
    await TestDatabaseManager.cleanAll();
  });

  afterAll(async () => {
    if (app) await app.close();
    await TestDatabaseManager.disconnect();
  });

  const server = () => request(app.getHttpServer());

  async function loginAsAdmin() {
    const admin = await factories.users.createAuthenticatedAdmin({
      password: await hash(PASSWORD, 10),
    });

    const challenge = await server().get('/auth/csrf').expect(200);
    const response = await server()
      .post('/auth/sessions')
      .set('Origin', ORIGIN)
      .set('Cookie', joinCookies(challenge))
      .set('X-CSRF-Token', readBody<CsrfBody>(challenge).csrfToken)
      .send({ email: admin.email, password: PASSWORD })
      .expect(200);

    return {
      admin,
      cookie: findCookie(response, SESSION_COOKIE),
      csrfToken: readBody<SessionBody>(response).csrfToken,
    };
  }

  async function invite(
    session: { cookie: string; csrfToken: string },
    email: string,
    role = 'NURSE',
  ) {
    const response = await server()
      .post('/onboarding/invites')
      .set('Origin', ORIGIN)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ email, fullName: 'Convidado Teste', userRole: role })
      .expect(201);

    return readBody<InviteBody>(response);
  }

  it('emite o convite sem devolver o token e entrega o link por e-mail', async () => {
    const session = await loginAsAdmin();
    const created = await invite(session, 'convidado@clinica.com.br');

    expect(created.status).toBe('ACTIVE');
    expect(JSON.stringify(created)).not.toContain('token');
    expect(delivered).toHaveLength(1);
    expect(delivered[0].email).toBe('convidado@clinica.com.br');
    expect(delivered[0].token).toEqual(expect.any(String));

    const listed = await server()
      .get('/onboarding/invites/list')
      .set('Cookie', session.cookie)
      .expect(200);

    const page = readBody<InvitePageBody>(listed);
    expect(page.total).toBe(1);
    expect(page.page).toBe(1);
    expect(JSON.stringify(page.items)).not.toContain(delivered[0].token);
  });

  it('entrega o contexto mínimo para quem abre o link', async () => {
    const session = await loginAsAdmin();
    await invite(session, 'contexto@clinica.com.br', 'PHYSICIAN');
    const token = delivered[0].token;

    const context = await server()
      .get(`/onboarding/invites/context/${token}`)
      .expect(200);

    const body = readBody<InviteContextBody>(context);
    expect(body.email).toBe('contexto@clinica.com.br');
    expect(body.role).toBe('PHYSICIAN');
    expect(body.organizationName).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toContain(token);
  });

  it('cria vínculo com papel e organização do convite', async () => {
    const session = await loginAsAdmin();
    await invite(session, 'vinculo@clinica.com.br', 'NURSE');
    const token = delivered[0].token;

    await server()
      .post(`/onboarding/registration/${token}`)
      .set('Origin', ORIGIN)
      .send({
        fullName: 'Jaqueline Oliveira',
        password: PASSWORD,
        profession: 'NURSE',
        phoneNumber: '62994315582',
      })
      .expect(201);

    const created = await prisma.user.findFirstOrThrow({
      where: { email: 'vinculo@clinica.com.br' },
      select: {
        professional: {
          select: {
            organizationId: true,
            professionalRoles: {
              where: { revokedAt: null },
              select: { role: true },
            },
          },
        },
      },
    });

    expect(created.professional?.organizationId).toBe(
      session.admin.organizationId,
    );
    expect(created.professional?.professionalRoles.map((r) => r.role)).toEqual([
      'NURSE',
    ]);

    // O mesmo convite não serve duas vezes.
    const reused = await server()
      .post(`/onboarding/registration/${token}`)
      .set('Origin', ORIGIN)
      .send({
        fullName: 'Outra Pessoa',
        password: PASSWORD,
        profession: 'NURSE',
        phoneNumber: '62911112222',
      })
      .expect(409);

    expect(readBody<ErrorBody>(reused).code).toBe('USER_INVITE_ALREADY_USED');
  });

  it('recusa convite expirado e convite cancelado com códigos distintos', async () => {
    const session = await loginAsAdmin();

    const expired = await invite(session, 'expirado@clinica.com.br');
    const expiredToken = delivered[0].token;
    await prisma.internalUserInvite.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const expiredResponse = await server()
      .get(`/onboarding/invites/context/${expiredToken}`)
      .expect(409);
    expect(readBody<ErrorBody>(expiredResponse).code).toBe(
      'USER_INVITE_EXPIRED',
    );

    delivered.length = 0;
    const cancelled = await invite(session, 'cancelado@clinica.com.br');
    const cancelledToken = delivered[0].token;

    await server()
      .delete(`/onboarding/invites/${cancelled.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .expect(204);

    const cancelledResponse = await server()
      .get(`/onboarding/invites/context/${cancelledToken}`)
      .expect(409);
    expect(readBody<ErrorBody>(cancelledResponse).code).toBe(
      'USER_INVITE_CANCELLED',
    );
  });

  it('não lista convites de outra organização', async () => {
    const session = await loginAsAdmin();
    await invite(session, 'daminhaorg@clinica.com.br');

    const otherAdmin = await factories.users.createAuthenticatedAdmin({
      password: await hash(PASSWORD, 10),
    });
    const challenge = await server().get('/auth/csrf').expect(200);
    const otherSession = await server()
      .post('/auth/sessions')
      .set('Origin', ORIGIN)
      .set('Cookie', joinCookies(challenge))
      .set('X-CSRF-Token', readBody<CsrfBody>(challenge).csrfToken)
      .send({ email: otherAdmin.email, password: PASSWORD })
      .expect(200);

    const listed = await server()
      .get('/onboarding/invites/list')
      .set('Cookie', findCookie(otherSession, SESSION_COOKIE))
      .expect(200);

    expect(readBody<InvitePageBody>(listed).total).toBe(0);
  });
});
