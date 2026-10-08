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
  administratorInvite: {
    id: string;
    email: string;
    role: string;
    expiresAt: string;
  };
}

interface RegisteredBody {
  userId: string;
  professionalId: string;
  email: string;
}

interface TeamPageBody {
  items: Array<{
    professionalId: string;
    userId: string;
    fullName: string;
    email: string;
    roles: string[];
    isActive: boolean;
  }>;
  page: number;
  pageSize: number;
  total: number;
}

describe('Provisionamento e equipe - Integração HTTP', () => {
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

  function provisionPayload(suffix: string) {
    return {
      organization: {
        name: `Clínica ${suffix}`,
        taxId: `1234567890${suffix.padStart(4, '0')}`.slice(0, 14),
      },
      administrator: {
        email: `admin.${suffix}@clinica.com.br`,
        fullName: `Administrador ${suffix}`,
      },
    };
  }

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
      .send(provisionPayload(suffix))
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
        fullName: `Administrador ${suffix}`,
        password: PASSWORD,
        profession: 'RECEPTIONIST',
        phoneNumber: '62999999999',
      })
      .expect(201);

    const admin = readBody<RegisteredBody>(registered);
    return {
      organization: provisioned.organization,
      administratorInvite: provisioned.administratorInvite,
      administrator: {
        userId: admin.userId,
        professionalId: admin.professionalId,
        email: admin.email,
      },
    };
  }

  it('recusa provisionamento sem a chave administrativa', async () => {
    const response = await server()
      .post('/admin/provisioning/organizations')
      .send(provisionPayload('1'))
      .expect(401);

    expect(readBody<ErrorBody>(response).code).toBe('PROVISIONING_KEY_INVALID');
    expect(await prisma.organization.count()).toBe(0);
  });

  it('provisiona com convite e o administrador define a própria senha no registro', async () => {
    const provisioned = await provisionOnly('2');

    expect(provisioned.administratorInvite.role).toBe('ADMINISTRATOR');
    expect(delivered).toHaveLength(1);
    expect(delivered[0].email).toBe(provisioned.administratorInvite.email);
    expect(JSON.stringify(provisioned)).not.toContain(delivered[0].token);
    expect(
      await prisma.user.count({ where: { id: { not: SYSTEM_ACTOR_ID } } }),
    ).toBe(0);

    await server()
      .post(`/onboarding/registration/${delivered[0].token}`)
      .set('Origin', ORIGIN)
      .send({
        fullName: 'Administrador 2',
        password: PASSWORD,
        profession: 'RECEPTIONIST',
        phoneNumber: '62999999999',
      })
      .expect(201);

    const session = await login(provisioned.administratorInvite.email);
    const me = await server()
      .get('/account/me')
      .set('Cookie', session.cookie)
      .set('Cookie', session.cookie).set('X-Session-Context', session.sessionId)
      .expect(200);

    expect(readBody<{ roles: string[] }>(me).roles).toEqual(['ADMINISTRATOR']);
  });

  it('não deixa a organização existir sem administrador quando o e-mail já é usado', async () => {
    const first = await provisionOrganization('3');

    const conflict = await server()
      .post('/admin/provisioning/organizations')
      .set('X-Provisioning-Key', PROVISIONING_KEY)
      .send({
        organization: { name: 'Outra Clínica', taxId: '99999999000199' },
        administrator: {
          email: first.administrator.email,
          fullName: 'Outro Administrador',
        },
      })
      .expect(409);

    expect(readBody<ErrorBody>(conflict).code).toBe('CONFLICT');
    expect(await prisma.organization.count()).toBe(1);
  });

  it('lista a equipe paginada apenas da própria organização', async () => {
    const own = await provisionOrganization('4');
    await provisionOrganization('5');

    const colleague = await factories.users.createColleagueWithRoles(
      own.organization.id,
      ['NURSE'],
      { password: await hash(PASSWORD, 10) },
    );

    const session = await login(own.administrator.email);
    const listed = await server()
      .get('/professionals?pageSize=10')
      .set('Cookie', session.cookie)
      .set('Cookie', session.cookie).set('X-Session-Context', session.sessionId)
      .expect(200);

    const page = readBody<TeamPageBody>(listed);
    expect(page.total).toBe(2);
    expect(page.pageSize).toBe(10);
    expect(page.items.map((member) => member.professionalId).sort()).toEqual(
      [colleague.professionalId, own.administrator.professionalId].sort(),
    );
    expect(
      page.items.find((m) => m.professionalId === colleague.professionalId)
        ?.roles,
    ).toEqual(['NURSE']);
  });

  it('filtra a equipe por papel e por busca', async () => {
    const own = await provisionOrganization('6');
    const nurse = await factories.users.createColleagueWithRoles(
      own.organization.id,
      ['NURSE'],
    );
    await prisma.professional.update({
      where: { id: nurse.professionalId! },
      data: { fullName: 'Jaqueline Oliveira' },
    });

    const session = await login(own.administrator.email);

    const byRole = await server()
      .get('/professionals?role=NURSE')
      .set('Cookie', session.cookie)
      .set('Cookie', session.cookie).set('X-Session-Context', session.sessionId)
      .expect(200);
    expect(readBody<TeamPageBody>(byRole).total).toBe(1);

    const bySearch = await server()
      .get('/professionals?search=jaqueline')
      .set('Cookie', session.cookie)
      .set('Cookie', session.cookie).set('X-Session-Context', session.sessionId)
      .expect(200);
    expect(readBody<TeamPageBody>(bySearch).items[0].fullName).toBe(
      'Jaqueline Oliveira',
    );
  });

  it('desativa o acesso preservando o cadastro e a autoria', async () => {
    const own = await provisionOrganization('7');
    const colleague = await factories.users.createColleagueWithRoles(
      own.organization.id,
      ['NURSE'],
      { password: await hash(PASSWORD, 10) },
    );

    const colleagueSession = await login(colleague.email);
    const admin = await login(own.administrator.email);

    await server()
      .patch(`/professionals/${colleague.professionalId}/access`)
      .set('Origin', ORIGIN)
      .set('Cookie', admin.cookie)
      .set('Cookie', admin.cookie).set('X-Session-Context', admin.sessionId)
      .set('X-CSRF-Token', admin.csrfToken)
      .send({ isActive: false })
      .expect(200);

    await server()
      .get('/account/me')
      .set('Cookie', colleagueSession.cookie)
      .set('Cookie', colleagueSession.cookie).set('X-Session-Context', colleagueSession.sessionId)
      .expect(401);

    const stored = await prisma.professional.findUnique({
      where: { id: colleague.professionalId! },
      select: { id: true, user: { select: { isActive: true } } },
    });
    expect(stored?.user.isActive).toBe(false);

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: colleague.professionalId!,
        action: 'PROFESSIONAL_DEACTIVATED',
      },
    });
    expect(audit).not.toBeNull();
  });

  it('impede que o administrador encerre o próprio acesso', async () => {
    const own = await provisionOrganization('8');
    const admin = await login(own.administrator.email);

    await server()
      .patch(`/professionals/${own.administrator.professionalId}/access`)
      .set('Origin', ORIGIN)
      .set('Cookie', admin.cookie)
      .set('Cookie', admin.cookie).set('X-Session-Context', admin.sessionId)
      .set('X-CSRF-Token', admin.csrfToken)
      .send({ isActive: false })
      .expect(403);
  });

  it('não alcança profissional de outra organização', async () => {
    const own = await provisionOrganization('9');
    const other = await provisionOrganization('10');
    const admin = await login(own.administrator.email);

    await server()
      .patch(`/professionals/${other.administrator.professionalId}`)
      .set('Origin', ORIGIN)
      .set('Cookie', admin.cookie)
      .set('Cookie', admin.cookie).set('X-Session-Context', admin.sessionId)
      .set('X-CSRF-Token', admin.csrfToken)
      .send({ fullName: 'Nome alterado indevidamente' })
      .expect(404);

    await server()
      .post('/roles')
      .set('Origin', ORIGIN)
      .set('Cookie', admin.cookie)
      .set('Cookie', admin.cookie).set('X-Session-Context', admin.sessionId)
      .set('X-CSRF-Token', admin.csrfToken)
      .send({
        professionalId: other.administrator.professionalId,
        name: 'NURSE',
      })
      .expect(404);

    const untouched = await prisma.professional.findUnique({
      where: { id: other.administrator.professionalId },
      select: { fullName: true },
    });
    expect(untouched?.fullName).toBe('Administrador 10');
  });

  it('atualiza o próprio cadastro sem tocar em papéis', async () => {
    const own = await provisionOrganization('11');
    const session = await login(own.administrator.email);

    const updated = await server()
      .patch('/professionals/me')
      .set('Origin', ORIGIN)
      .set('Cookie', session.cookie)
      .set('Cookie', session.cookie).set('X-Session-Context', session.sessionId)
      .set('X-CSRF-Token', session.csrfToken)
      .send({
        fullName: 'Carla Souza',
        councilNumber: '24815',
        councilUf: 'go',
      })
      .expect(200);

    const body = readBody<{ fullName: string; councilUf: string }>(updated);
    expect(body.fullName).toBe('Carla Souza');
    expect(body.councilUf).toBe('GO');

    const me = await server()
      .get('/account/me')
      .set('Cookie', session.cookie)
      .set('Cookie', session.cookie).set('X-Session-Context', session.sessionId)
      .expect(200);
    expect(readBody<{ roles: string[] }>(me).roles).toEqual(['ADMINISTRATOR']);
  });

  it('atualiza nome e fuso da própria organização por contrato próprio', async () => {
    const own = await provisionOrganization('12');
    const session = await login(own.administrator.email);

    const updated = await server()
      .patch('/organization/me')
      .set('Origin', ORIGIN)
      .set('Cookie', session.cookie)
      .set('Cookie', session.cookie).set('X-Session-Context', session.sessionId)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ name: 'Clínica Integrada', timeZone: 'America/Manaus' })
      .expect(200);

    const body = readBody<{ name: string; timeZone: string }>(updated);
    expect(body.name).toBe('Clínica Integrada');
    expect(body.timeZone).toBe('America/Manaus');

    const rejected = await server()
      .patch('/organization/me')
      .set('Origin', ORIGIN)
      .set('Cookie', session.cookie)
      .set('Cookie', session.cookie).set('X-Session-Context', session.sessionId)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ timeZone: 'Marte/Olympus' })
      .expect(400);

    expect(readBody<ErrorBody>(rejected).code).toBe('VALIDATION_ERROR');
  });
});
