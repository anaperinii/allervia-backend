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
const SESSION_COOKIE = 'allervia_session_v2';
const PROVISIONING_KEY = 'chave-de-provisionamento-de-teste-0001';
const SYSTEM_ACTOR_ID = 'TEST0SYSTEM0ACTOR000000000';

interface ProvisionedBody {
  organization: { id: string; name: string; taxId: string };
  administratorInvite: { id: string; email: string };
}

interface RegisteredBody {
  userId: string;
  professionalId: string;
  email: string;
}

describe('Salvaguardas de equipe e convites - Integração HTTP', () => {
  let app: INestApplication<App>;
  let module: TestingModule;
  let prisma: PrismaService;
  let factories: TestFactories;
  const delivered: InviteEmailParams[] = [];

  beforeAll(async () => {
    process.env.AUTH_INSECURE_COOKIES = 'true';
    process.env.AUTH_MFA_ENFORCEMENT = 'optional';
    process.env.AUTH_ALLOWED_ORIGINS = ORIGIN;
    process.env.SUPER_ADMIN_REGISTRATION_KEY = PROVISIONING_KEY;
    process.env.SYSTEM_USER_ID = SYSTEM_ACTOR_ID;

    await TestDatabaseManager.connect();

    const emailSpy: IEmailService = {
      sendPasswordResetLink: () => Promise.resolve(),
      sendPasswordChangedNotification: () => Promise.resolve(),
      sendDemoRequest: () => Promise.resolve(),
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
    await prisma.user.create({
      data: {
        id: SYSTEM_ACTOR_ID,
        email: 'system.actor@test.local',
        password: 'sem-login',
        type: 'PROFESSIONAL',
        isActive: false,
      },
    });
  });

  afterAll(async () => {
    if (app) await app.close();
    await TestDatabaseManager.disconnect();
  });

  const server = () => request(app.getHttpServer());

  async function login(email: string) {
    const challenge = await server().get('/auth/csrf').expect(200);
    const response = await server()
      .post('/auth/sessions')
      .set('Origin', ORIGIN)
      .set('Cookie', joinCookies(challenge))
      .set('X-CSRF-Token', readBody<CsrfBody>(challenge).csrfToken)
      .send({ email, password: PASSWORD })
      .expect(200);
    return {
      cookie: findCookie(response, SESSION_COOKIE),
      sessionId: readBody<SessionBody>(response).session.id,
      csrfToken: readBody<SessionBody>(response).csrfToken,
    };
  }

  async function provisionOnly(suffix: string) {
    const response = await server()
      .post('/admin/provisioning/organizations')
      .set('X-Provisioning-Key', PROVISIONING_KEY)
      .send({
        organization: {
          name: `Clínica Guard ${suffix}`,
          taxId: `9876543210${suffix.padStart(4, '0')}`.slice(0, 14),
        },
        administrator: {
          email: `admin.guard${suffix}@clinica.com.br`,
          fullName: `Administrador Guard ${suffix}`,
        },
      })
      .expect(201);
    return readBody<ProvisionedBody>(response);
  }

  async function provisionOrganization(suffix: string) {
    const provisioned = await provisionOnly(suffix);
    const invite = delivered.find(
      (mail) => mail.email === provisioned.administratorInvite.email,
    )!;
    const registered = await server()
      .post(`/onboarding/registration/${invite.token}`)
      .set('Origin', ORIGIN)
      .send({
        fullName: `Administrador Guard ${suffix}`,
        password: PASSWORD,
        profession: 'RECEPTIONIST',
        phoneNumber: '62999999999',
      })
      .expect(201);
    const admin = readBody<RegisteredBody>(registered);
    return { organization: provisioned.organization, administrator: admin };
  }

  it('não revoga o papel do último administrador ativo', async () => {
    const own = await provisionOrganization('1');
    const session = await login(own.administrator.email);

    const role = await prisma.professionalRole.findFirstOrThrow({
      where: {
        professionalId: own.administrator.professionalId,
        role: 'ADMINISTRATOR',
        revokedAt: null,
      },
    });

    const response = await server()
      .delete(`/roles/${role.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', session.cookie)
      .set('X-Session-Context', session.sessionId)
      .set('X-CSRF-Token', session.csrfToken)
      .expect(409);
    expect(readBody<ErrorBody>(response).code).toBe('LAST_ADMINISTRATOR');
    expect(
      await prisma.professionalRole.count({
        where: { id: role.id, revokedAt: null },
      }),
    ).toBe(1);
  });

  it('duas desativações simultâneas de administradores preservam ao menos um ativo', async () => {
    const own = await provisionOrganization('2');
    const second = await factories.users.createColleagueWithRoles(
      own.organization.id,
      ['ADMINISTRATOR'],
      { password: await hash(PASSWORD, 10) },
    );

    const first = await login(own.administrator.email);
    const other = await login(second.email);

    const disable = (
      session: Awaited<ReturnType<typeof login>>,
      targetProfessionalId: string,
    ) =>
      server()
        .patch(`/professionals/${targetProfessionalId}/access`)
        .set('Origin', ORIGIN)
        .set('Cookie', session.cookie)
        .set('X-Session-Context', session.sessionId)
        .set('X-CSRF-Token', session.csrfToken)
        .send({ isActive: false });

    const [a, b] = await Promise.all([
      disable(first, second.professionalId!),
      disable(other, own.administrator.professionalId),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(200);
    expect([401, 409]).toContain(statuses[1]);

    const activeAdministrators = await prisma.professional.count({
      where: {
        organizationId: own.organization.id,
        user: { isActive: true },
        professionalRoles: { some: { role: 'ADMINISTRATOR', revokedAt: null } },
      },
    });
    expect(activeAdministrators).toBeGreaterThanOrEqual(1);
  });

  it('conclusões simultâneas do mesmo convite criam exatamente uma conta', async () => {
    const provisioned = await provisionOnly('3');
    const invite = delivered.find(
      (mail) => mail.email === provisioned.administratorInvite.email,
    )!;

    const complete = () =>
      server()
        .post(`/onboarding/registration/${invite.token}`)
        .set('Origin', ORIGIN)
        .send({
          fullName: 'Administrador Corrida',
          password: PASSWORD,
          profession: 'RECEPTIONIST',
          phoneNumber: '62999999999',
        });

    const [a, b] = await Promise.all([complete(), complete()]);
    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(201);
    expect(statuses[1]).toBe(409);

    expect(
      await prisma.user.count({
        where: { email: provisioned.administratorInvite.email },
      }),
    ).toBe(1);
    expect(
      await prisma.internalUserInvite.count({
        where: { email: provisioned.administratorInvite.email, usedAt: null },
      }),
    ).toBe(0);
  });

  it('papel sem gestão de equipe não altera acesso de membros', async () => {
    const own = await provisionOrganization('4');
    const nurse = await factories.users.createColleagueWithRoles(
      own.organization.id,
      ['NURSE'],
      { password: await hash(PASSWORD, 10) },
    );
    const session = await login(nurse.email);

    await server()
      .patch(`/professionals/${own.administrator.professionalId}/access`)
      .set('Origin', ORIGIN)
      .set('Cookie', session.cookie)
      .set('X-Session-Context', session.sessionId)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ isActive: false })
      .expect(403);

    expect(
      await prisma.user.count({
        where: { id: own.administrator.userId, isActive: true },
      }),
    ).toBe(1);
  });
});
