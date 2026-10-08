import { Test, TestingModule } from '@nestjs/testing';
import { randomBytes, createHash } from 'node:crypto';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { AppointmentsService } from 'src/scheduling/appointments.service';
import {
  GoogleApiError,
  GoogleCalendarClient,
  GoogleEvent,
} from '../../google-calendar.client';
import { GoogleTokenBoxService } from '../../google-token-box.service';
import { CalendarSyncService } from '../../calendar-sync.service';
import { CalendarInboundSyncService } from '../../calendar-inbound-sync.service';
import { GoogleCalendarWebhookController } from '../../google-calendar-webhook.controller';
import { ALLERVIA_APPOINTMENT_ID_KEY } from '../../google-event-mapper.service';
import { FakeGoogleCalendarClient } from './fake-google-calendar.client';

describe('Google Calendar sync - Integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let factories: TestFactories;
  let appointments: AppointmentsService;
  let sync: CalendarSyncService;
  let inbound: CalendarInboundSyncService;
  let webhook: GoogleCalendarWebhookController;
  let tokenBox: GoogleTokenBoxService;
  const fakeClient = new FakeGoogleCalendarClient();

  let physician: AuthenticatedUserPayload;
  let patientId: string;

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_OAUTH_REDIRECT_URL =
      'http://localhost:3000/integrations/google-calendar/callback';
    process.env.GOOGLE_WEBHOOK_URL =
      'https://example.test/integrations/google-calendar/webhook';
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY =
      randomBytes(32).toString('base64');

    await TestDatabaseManager.connect();
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .overrideProvider(GoogleCalendarClient)
      .useValue(fakeClient)
      .compile();
    prisma = module.get(PrismaService);
    appointments = module.get(AppointmentsService);
    sync = module.get(CalendarSyncService);
    inbound = module.get(CalendarInboundSyncService);
    webhook = module.get(GoogleCalendarWebhookController);
    tokenBox = module.get(GoogleTokenBoxService);
    factories = new TestFactories(prisma);
  });

  afterAll(async () => {
    await module.close();
    await TestDatabaseManager.disconnect();
  });

  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();
    fakeClient.reset();
    physician =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const patient = await factories.patients.create({
      organizationId: physician.organizationId,
      responsiblePhysicianId: physician.professionalId!,
      createdById: physician.id,
      updatedById: physician.id,
    });
    patientId = patient.id;
    const systemUser = await factories.users.create();
    process.env.SYSTEM_USER_ID = systemUser.id;
  });

  function sealedToken() {
    const sealed = tokenBox.seal('fake-refresh-token');
    return {
      refreshTokenCiphertext: sealed.ciphertext,
      refreshTokenIv: sealed.iv,
      refreshTokenAuthTag: sealed.authTag,
      keyVersion: sealed.keyVersion,
    };
  }

  async function createConnection(
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string }> {
    return factories.googleCalendarConnections.create({
      organizationId: physician.organizationId,
      professionalId: physician.professionalId!,
      ...sealedToken(),
      ...overrides,
    } as never);
  }

  async function createAppointment(startsAt = '2026-11-10T13:00:00.000Z') {
    return appointments.create(
      {
        patientId,
        professionalId: physician.professionalId!,
        startsAt,
        endsAt: '2026-11-10T13:30:00.000Z',
        notes: 'Aplicar dose',
      },
      physician,
    );
  }

  it('enqueues a deduplicated push job on create and update', async () => {
    const appointment = await createAppointment();
    const pendingAfterCreate = await prisma.calendarSyncJob.findMany({
      where: { kind: 'PUSH_SYNC', processedAt: null },
    });
    expect(pendingAfterCreate).toHaveLength(1);
    expect(pendingAfterCreate[0].appointmentId).toBe(appointment.id);

    await appointments.update(
      appointment.id,
      { expectedRevision: 0, title: 'Retorno' },
      physician,
    );
    const pendingAfterUpdate = await prisma.calendarSyncJob.count({
      where: { kind: 'PUSH_SYNC', processedAt: null },
    });
    expect(pendingAfterUpdate).toBe(1);

    const persisted = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(persisted.title).toBe('Retorno');
    expect(persisted.revision).toBe(1);
  });

  it('frees the pending slot when a job dead-letters', async () => {
    await createConnection();
    const appointment = await createAppointment();

    await prisma.calendarSyncJob.updateMany({
      where: { kind: 'PUSH_SYNC', appointmentId: appointment.id },
      data: { attempts: 7 },
    });
    fakeClient.nextError = new GoogleApiError(503, null, null, 'down');
    await sync.processPending();

    const dead = await prisma.calendarSyncJob.findFirstOrThrow({
      where: { kind: 'PUSH_SYNC', appointmentId: appointment.id },
    });
    expect(dead.attempts).toBe(8);
    expect(dead.processedAt).not.toBeNull();

    await appointments.update(
      appointment.id,
      { expectedRevision: 0, title: 'Nova tentativa' },
      physician,
    );
    expect(
      await prisma.calendarSyncJob.count({
        where: {
          kind: 'PUSH_SYNC',
          appointmentId: appointment.id,
          processedAt: null,
        },
      }),
    ).toBe(1);
  });

  it('pushes create, reschedule and cancellation to Google', async () => {
    await createConnection();
    const appointment = await createAppointment();

    await sync.processPending();
    expect(fakeClient.callsTo('insertEvent')).toHaveLength(1);
    let link = await prisma.googleCalendarEventLink.findUnique({
      where: { appointmentId: appointment.id },
    });
    expect(link?.googleEventId).toBe('evt-1');
    expect(link?.lastSyncedHash).toBeTruthy();

    await sync.processPending();
    expect(fakeClient.callsTo('insertEvent')).toHaveLength(1);

    await appointments.update(
      appointment.id,
      {
        expectedRevision: 0,
        startsAt: '2026-11-11T13:00:00.000Z',
        endsAt: '2026-11-11T13:30:00.000Z',
      },
      physician,
    );
    await sync.processPending();
    expect(fakeClient.callsTo('patchEvent')).toHaveLength(1);

    await appointments.update(
      appointment.id,
      {
        expectedRevision: 1,
        status: 'CANCELLED',
        statusReason: 'Paciente pediu',
      },
      physician,
    );
    await sync.processPending();
    expect(fakeClient.callsTo('deleteEvent')).toHaveLength(1);
    link = await prisma.googleCalendarEventLink.findUnique({
      where: { appointmentId: appointment.id },
    });
    expect(link?.deletedAt).not.toBeNull();
  });

  it('skips silently when the professional has no connection', async () => {
    await createAppointment();
    const result = await sync.processPending();
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(fakeClient.calls).toHaveLength(0);
  });

  it('retries with backoff on Google 5xx', async () => {
    await createConnection();
    await createAppointment();
    fakeClient.nextError = new GoogleApiError(503, null, null, 'unavailable');

    const result = await sync.processPending();
    expect(result.failed).toBe(1);

    const job = await prisma.calendarSyncJob.findFirstOrThrow({
      where: { kind: 'PUSH_SYNC' },
    });
    expect(job.processedAt).toBeNull();
    expect(job.attempts).toBe(1);
    expect(job.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(job.lastError).toContain('unavailable');
  });

  it('marks the connection BROKEN on invalid_grant', async () => {
    const connection = await createConnection();
    await createAppointment();
    fakeClient.refreshError = new GoogleApiError(
      400,
      'invalid_grant',
      null,
      'invalid grant',
    );

    await sync.processPending();
    const stored = await prisma.googleCalendarConnection.findUniqueOrThrow({
      where: { id: connection.id },
    });
    expect(stored.status).toBe('BROKEN');
    fakeClient.refreshError = null;

    const result = await sync.processPending();
    expect(result.failed).toBe(0);
    expect(fakeClient.callsTo('insertEvent')).toHaveLength(0);
  });

  it('accepts webhook notifications only with the right channel token', async () => {
    const channelToken = 'segredo-do-canal';
    const connection = await createConnection({
      channelId: 'chan-1',
      channelResourceId: 'res-1',
      channelTokenHash: createHash('sha256').update(channelToken).digest('hex'),
    });

    await webhook.webhook('chan-1', 'exists', 'token-errado');
    expect(
      await prisma.calendarSyncJob.count({
        where: { kind: 'PULL_INCREMENTAL' },
      }),
    ).toBe(0);

    await webhook.webhook('chan-1', 'exists', channelToken);
    await webhook.webhook('chan-1', 'exists', channelToken);
    const jobs = await prisma.calendarSyncJob.findMany({
      where: { kind: 'PULL_INCREMENTAL', processedAt: null },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].connectionId).toBe(connection.id);
  });

  async function pushedAppointment() {
    const connection = await createConnection({ syncToken: 'sync-token-1' });
    const appointment = await createAppointment();
    await sync.processPending();
    const link = await prisma.googleCalendarEventLink.findUniqueOrThrow({
      where: { appointmentId: appointment.id },
    });
    fakeClient.calls = [];
    return { connection, appointment, link };
  }

  function googleEvent(
    appointmentId: string,
    link: { googleEventId: string },
    overrides: Partial<GoogleEvent> = {},
  ): GoogleEvent {
    return {
      id: link.googleEventId,
      etag: '"etag-externo"',
      status: 'confirmed',
      start: { dateTime: '2026-11-10T13:00:00.000Z' },
      end: { dateTime: '2026-11-10T13:30:00.000Z' },
      extendedProperties: {
        private: { [ALLERVIA_APPOINTMENT_ID_KEY]: appointmentId },
      },
      ...overrides,
    };
  }

  it('applies a time change coming from Google with system audit', async () => {
    const { connection, appointment, link } = await pushedAppointment();
    fakeClient.listPages = [
      {
        items: [
          googleEvent(appointment.id, link, {
            start: { dateTime: '2026-11-10T15:00:00.000Z' },
            end: { dateTime: '2026-11-10T15:30:00.000Z' },
          }),
        ],
        nextSyncToken: 'sync-token-2',
      },
    ];

    await inbound.processIncremental({
      id: 'job-test',
      organizationId: physician.organizationId,
      kind: 'PULL_INCREMENTAL',
      connectionId: connection.id,
      appointmentId: null,
      payload: null,
      pendingKey: null,
      attempts: 0,
      nextAttemptAt: new Date(),
      leaseUntil: null,
      processedAt: null,
      lastError: null,
      createdAt: new Date(),
    });

    const updated = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(updated.startsAt.toISOString()).toBe('2026-11-10T15:00:00.000Z');
    expect(updated.revision).toBe(appointment.revision + 1);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'APPOINTMENT_UPDATED_FROM_GOOGLE' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.userId).toBe(process.env.SYSTEM_USER_ID);

    const stored = await prisma.googleCalendarConnection.findUniqueOrThrow({
      where: { id: connection.id },
    });
    expect(stored.syncToken).toBe('sync-token-2');
  });

  it('suppresses echoes of its own push', async () => {
    const { connection, appointment, link } = await pushedAppointment();
    fakeClient.listPages = [
      {
        items: [googleEvent(appointment.id, link)],
        nextSyncToken: 'sync-token-2',
      },
    ];

    await inbound.processIncremental({
      id: 'job-test',
      organizationId: physician.organizationId,
      kind: 'PULL_INCREMENTAL',
      connectionId: connection.id,
      appointmentId: null,
      payload: null,
      pendingKey: null,
      attempts: 0,
      nextAttemptAt: new Date(),
      leaseUntil: null,
      processedAt: null,
      lastError: null,
      createdAt: new Date(),
    });

    const stored = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(stored.revision).toBe(appointment.revision);
    expect(
      await prisma.calendarSyncJob.count({
        where: { kind: 'PUSH_SYNC', processedAt: null },
      }),
    ).toBe(0);
  });

  it('re-pushes when the event is deleted on Google', async () => {
    const { connection, appointment, link } = await pushedAppointment();
    fakeClient.listPages = [
      {
        items: [
          googleEvent(appointment.id, link, {
            status: 'cancelled',
            start: undefined,
            end: undefined,
          }),
        ],
        nextSyncToken: 'sync-token-2',
      },
    ];

    await inbound.processIncremental({
      id: 'job-test',
      organizationId: physician.organizationId,
      kind: 'PULL_INCREMENTAL',
      connectionId: connection.id,
      appointmentId: null,
      payload: null,
      pendingKey: null,
      attempts: 0,
      nextAttemptAt: new Date(),
      leaseUntil: null,
      processedAt: null,
      lastError: null,
      createdAt: new Date(),
    });

    expect(
      await prisma.googleCalendarEventLink.findUnique({
        where: { appointmentId: appointment.id },
      }),
    ).toBeNull();
    expect(
      await prisma.calendarSyncJob.count({
        where: { kind: 'PUSH_SYNC', processedAt: null },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { action: 'GOOGLE_EVENT_RESTORED' },
      }),
    ).toBe(1);
  });

  it('restores canonical content when title or notes are edited in Google', async () => {
    const { connection, appointment, link } = await pushedAppointment();
    fakeClient.listPages = [
      {
        items: [
          googleEvent(appointment.id, link, {
            summary: 'Renomeado no Google',
            description: 'Aplicar dose',
          }),
        ],
        nextSyncToken: 'sync-token-2',
      },
    ];

    await inbound.processIncremental({
      id: 'job-test',
      organizationId: physician.organizationId,
      kind: 'PULL_INCREMENTAL',
      connectionId: connection.id,
      appointmentId: null,
      payload: null,
      pendingKey: null,
      attempts: 0,
      nextAttemptAt: new Date(),
      leaseUntil: null,
      processedAt: null,
      lastError: null,
      createdAt: new Date(),
    });

    const storedLink = await prisma.googleCalendarEventLink.findUniqueOrThrow({
      where: { appointmentId: appointment.id },
    });
    expect(storedLink.lastSyncedHash).toBeNull();
    expect(
      await prisma.calendarSyncJob.count({
        where: { kind: 'PUSH_SYNC', processedAt: null },
      }),
    ).toBe(1);

    await sync.processPending();
    const patchCalls = fakeClient.callsTo('patchEvent');
    expect(patchCalls).toHaveLength(1);
    const patient = await prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
    });
    expect((patchCalls[0].args[2] as { summary: string }).summary).toBe(
      `Consulta — ${patient.fullName.trim().split(/\s+/)[0]}`,
    );
  });

  it('lets Allervia win when both sides changed', async () => {
    const { connection, appointment, link } = await pushedAppointment();
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { notes: 'Nota alterada internamente' },
    });
    fakeClient.listPages = [
      {
        items: [
          googleEvent(appointment.id, link, {
            start: { dateTime: '2026-11-10T18:00:00.000Z' },
            end: { dateTime: '2026-11-10T18:30:00.000Z' },
          }),
        ],
        nextSyncToken: 'sync-token-2',
      },
    ];

    await inbound.processIncremental({
      id: 'job-test',
      organizationId: physician.organizationId,
      kind: 'PULL_INCREMENTAL',
      connectionId: connection.id,
      appointmentId: null,
      payload: null,
      pendingKey: null,
      attempts: 0,
      nextAttemptAt: new Date(),
      leaseUntil: null,
      processedAt: null,
      lastError: null,
      createdAt: new Date(),
    });

    const stored = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(stored.startsAt.toISOString()).toBe('2026-11-10T13:00:00.000Z');
    expect(
      await prisma.calendarSyncJob.count({
        where: { kind: 'PUSH_SYNC', processedAt: null },
      }),
    ).toBe(1);
  });

  it('falls back to full resync on 410 GONE', async () => {
    const { connection } = await pushedAppointment();
    fakeClient.nextError = new GoogleApiError(410, null, null, 'gone');

    await inbound.processIncremental({
      id: 'job-test',
      organizationId: physician.organizationId,
      kind: 'PULL_INCREMENTAL',
      connectionId: connection.id,
      appointmentId: null,
      payload: null,
      pendingKey: null,
      attempts: 0,
      nextAttemptAt: new Date(),
      leaseUntil: null,
      processedAt: null,
      lastError: null,
      createdAt: new Date(),
    });

    const stored = await prisma.googleCalendarConnection.findUniqueOrThrow({
      where: { id: connection.id },
    });
    expect(stored.syncToken).toBe('sync-token-next');
    expect(stored.lastFullSyncAt).not.toBeNull();
    const listCalls = fakeClient.callsTo('listEvents');
    expect(listCalls.length).toBeGreaterThanOrEqual(2);
    expect(
      (listCalls.at(-1)?.args[1] as { syncToken?: string }).syncToken,
    ).toBeUndefined();
  });
});
