import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { hash } from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from 'src/app.module';
import { configureApp } from 'src/app.setup';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { expectErrorEnvelope } from 'test/support/envelope';
import {
  findCookie,
  joinCookies,
  readBody,
  type CsrfBody,
  type SessionBody,
} from 'test/support/http';

const PASSWORD = 'Senha!Forte#2026';
const ORIGIN = 'http://127.0.0.1';
const SESSION_COOKIE = 'allervia_session_v2';

interface AppointmentBody {
  id: string;
  status: string;
  revision: number;
  startsAt: string;
  professionalId: string;
}

describe('Agenda (appointments) - Integração HTTP', () => {
  let app: NestExpressApplication;
  let module: TestingModule;
  let prisma: PrismaService;
  let factories: TestFactories;

  beforeAll(async () => {
    process.env.AUTH_INSECURE_COOKIES = 'true';
    process.env.AUTH_MFA_ENFORCEMENT = 'optional';
    process.env.AUTH_ALLOWED_ORIGINS = ORIGIN;

    await TestDatabaseManager.connect();
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureApp(app);
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

  const server = () => request(app.getHttpServer() as App);

  async function login(email: string) {
    const challenge = await server().get('/auth/csrf').expect(200);
    const response = await server()
      .post('/auth/sessions')
      .set('Origin', ORIGIN)
      .set('Cookie', joinCookies(challenge))
      .set('X-CSRF-Token', readBody<CsrfBody>(challenge).csrfToken)
      .send({ email, password: PASSWORD })
      .expect(200);
    const body = readBody<SessionBody>(response);
    return {
      cookie: findCookie(response, SESSION_COOKIE),
      csrfToken: body.csrfToken,
      sessionId: body.session.id,
    };
  }

  function headers(session: {
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

  async function createPatient(
    organizationId: string,
    responsiblePhysicianId: string,
    createdByUserId: string,
  ) {
    return prisma.patient.create({
      data: {
        fullName: 'Paciente Agenda Teste',
        birthDate: new Date('1990-01-01'),
        weightInKg: 70,
        phoneNumber: '62999999999',
        organization: { connect: { id: organizationId } },
        responsiblePhysician: { connect: { id: responsiblePhysicianId } },
        createdBy: { connect: { id: createdByUserId } },
        updatedBy: { connect: { id: createdByUserId } },
      },
    });
  }

  async function physicianWithPatient() {
    const physician =
      await factories.users.createAuthenticatedPhysicianProfessional({
        password: await hash(PASSWORD, 10),
      });
    const patient = await createPatient(
      physician.organizationId,
      physician.professionalId!,
      physician.id,
    );
    const session = await login(physician.email);
    return { physician, patient, session };
  }

  function window(offsetHours = 24) {
    const startsAt = new Date(Date.now() + offsetHours * 3600_000);
    const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
    return {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    };
  }

  it('AC-42: exige sessão com o envelope real', async () => {
    const response = await server().get(
      '/appointments?from=2026-01-01T00:00:00Z&to=2026-01-31T00:00:00Z',
    );
    expectErrorEnvelope(response, { status: 401, code: 'SESSION_MISSING' });
  });

  it('AC-42: cria, lista e audita com identidade Appointment', async () => {
    const { physician, patient, session } = await physicianWithPatient();

    const created = await server()
      .post('/appointments')
      .set(headers(session))
      .send({
        patientId: patient.id,
        professionalId: physician.professionalId,
        title: 'Consulta de rotina',
        ...window(),
      })
      .expect(201);
    const appointment = readBody<AppointmentBody>(created);
    expect(appointment.status).toBe('SCHEDULED');

    const admin = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['ADMINISTRATOR'],
      { password: await hash(PASSWORD, 10) },
    );
    const adminSession = await login(admin.email);
    const audit = await server()
      .get(`/audit-logs/entity/Appointment/${appointment.id}`)
      .set(headers(adminSession))
      .expect(200);
    const entries =
      readBody<Array<{ action: string; entityId: string }>>(audit);
    expect(entries.some((e) => e.action === 'APPOINTMENT_CREATED')).toBe(true);
    expect(entries[0].entityId).toBe(appointment.id);

    const list = await server()
      .get(
        `/appointments?from=${new Date(Date.now() - 3600_000).toISOString()}&to=${new Date(
          Date.now() + 72 * 3600_000,
        ).toISOString()}`,
      )
      .set(headers(session))
      .expect(200);
    expect(readBody<{ total: number }>(list).total).toBe(1);
  });

  it('AC-43: fim antes do início é 400 sem persistir nada', async () => {
    const { physician, patient, session } = await physicianWithPatient();
    const base = window();
    const response = await server()
      .post('/appointments')
      .set(headers(session))
      .send({
        patientId: patient.id,
        professionalId: physician.professionalId,
        startsAt: base.endsAt,
        endsAt: base.startsAt,
      });
    expectErrorEnvelope(response, { status: 400, code: 'INVALID_PERIOD' });
    expect(await prisma.appointment.count()).toBe(0);
  });

  it('DEC-01: paciente inativo não recebe novo agendamento', async () => {
    const { physician, patient, session } = await physicianWithPatient();
    await prisma.patient.update({
      where: { id: patient.id },
      data: { isActive: false },
    });

    const response = await server()
      .post('/appointments')
      .set(headers(session))
      .send({
        patientId: patient.id,
        professionalId: physician.professionalId,
        ...window(),
      });
    expectErrorEnvelope(response, { status: 409, code: 'PATIENT_INACTIVE' });
    expect(await prisma.appointment.count()).toBe(0);
  });

  it('AC-43: paciente de outra organização é 404 opaco', async () => {
    const { physician, session } = await physicianWithPatient();
    const stranger =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const foreignPatient = await createPatient(
      stranger.organizationId,
      stranger.professionalId!,
      stranger.id,
    );

    const response = await server()
      .post('/appointments')
      .set(headers(session))
      .send({
        patientId: foreignPatient.id,
        professionalId: physician.professionalId,
        ...window(),
      });
    expectErrorEnvelope(response, { status: 404, code: 'PATIENT_NOT_FOUND' });
    expect(await prisma.appointment.count()).toBe(0);
  });

  it('AC-43: agendamento sem vínculo (nem paciente nem agenda do ator) é 403 com rollback total', async () => {
    const { physician, session } = await physicianWithPatient();
    const colleague = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['PHYSICIAN'],
    );

    const foreignPatient = await createPatient(
      physician.organizationId,
      colleague.professionalId!,
      colleague.id,
    );

    const response = await server()
      .post('/appointments')
      .set(headers(session))
      .send({
        patientId: foreignPatient.id,
        professionalId: colleague.professionalId,
        ...window(),
      });
    expectErrorEnvelope(response, {
      status: 403,
      code: 'APPOINTMENT_NOT_ACCESSIBLE',
    });

    expect(await prisma.appointment.count()).toBe(0);
  });

  it('AC-43: revisão obsoleta, falta antes do início e motivo obrigatório', async () => {
    const { physician, patient, session } = await physicianWithPatient();
    const created = await server()
      .post('/appointments')
      .set(headers(session))
      .send({
        patientId: patient.id,
        professionalId: physician.professionalId,
        ...window(),
      })
      .expect(201);
    const appointment = readBody<AppointmentBody>(created);

    const stale = await server()
      .patch(`/appointments/${appointment.id}`)
      .set(headers(session))
      .send({ expectedRevision: 99, title: 'X' });
    expectErrorEnvelope(stale, {
      status: 409,
      code: 'STALE_APPOINTMENT_REVISION',
    });

    const missingReason = await server()
      .patch(`/appointments/${appointment.id}`)
      .set(headers(session))
      .send({ expectedRevision: appointment.revision, status: 'CANCELLED' });
    expectErrorEnvelope(missingReason, {
      status: 400,
      code: 'STATUS_REASON_REQUIRED',
    });

    const missedEarly = await server()
      .patch(`/appointments/${appointment.id}`)
      .set(headers(session))
      .send({
        expectedRevision: appointment.revision,
        status: 'MISSED',
        statusReason: 'não compareceu',
      });
    expectErrorEnvelope(missedEarly, {
      status: 409,
      code: 'MISS_BEFORE_START',
    });
  });

  it('AC-43/44: encerrado é terminal; trilha registra o motivo real', async () => {
    const { physician, patient, session } = await physicianWithPatient();
    const created = await server()
      .post('/appointments')
      .set(headers(session))
      .send({
        patientId: patient.id,
        professionalId: physician.professionalId,
        ...window(),
      })
      .expect(201);
    const appointment = readBody<AppointmentBody>(created);

    await server()
      .patch(`/appointments/${appointment.id}`)
      .set(headers(session))
      .send({
        expectedRevision: appointment.revision,
        status: 'CANCELLED',
        statusReason: 'paciente remarcou',
      })
      .expect(200);

    const reopened = await server()
      .patch(`/appointments/${appointment.id}`)
      .set(headers(session))
      .send({
        expectedRevision: appointment.revision + 1,
        status: 'SCHEDULED',
      });
    expectErrorEnvelope(reopened, {
      status: 409,
      code: 'APPOINTMENT_ALREADY_CLOSED',
    });

    const auditEntry = await prisma.auditLog.findFirst({
      where: { entityId: appointment.id, action: 'APPOINTMENT_UPDATED' },
      orderBy: { timestamp: 'desc' },
    });
    expect(auditEntry?.entityType).toBe('Appointment');
    expect(
      (auditEntry?.newValues as { statusReason: string }).statusReason,
    ).toBe('paciente remarcou');
  });

  it('AC-46: tipo de entidade desconhecido na trilha é 400, não 200 vazio', async () => {
    const admin = await factories.users.createAuthenticatedAdmin({
      password: await hash(PASSWORD, 10),
    });
    const session = await login(admin.email);
    const response = await server()
      .get('/audit-logs/entity/Banana/qualquer')
      .set(headers(session));
    expectErrorEnvelope(response, {
      status: 400,
      code: 'VALIDATION_ERROR',
      fieldErrors: ['entityType'],
    });
  });

  it('AC-42: isolamento entre organizações na listagem', async () => {
    const { physician, patient, session } = await physicianWithPatient();
    await server()
      .post('/appointments')
      .set(headers(session))
      .send({
        patientId: patient.id,
        professionalId: physician.professionalId,
        ...window(),
      })
      .expect(201);

    const outsider =
      await factories.users.createAuthenticatedPhysicianProfessional({
        password: await hash(PASSWORD, 10),
      });
    const outsiderSession = await login(outsider.email);
    const list = await server()
      .get(
        `/appointments?from=${new Date(Date.now() - 3600_000).toISOString()}&to=${new Date(
          Date.now() + 72 * 3600_000,
        ).toISOString()}`,
      )
      .set(headers(outsiderSession))
      .expect(200);
    expect(readBody<{ total: number }>(list).total).toBe(0);
  });
});
