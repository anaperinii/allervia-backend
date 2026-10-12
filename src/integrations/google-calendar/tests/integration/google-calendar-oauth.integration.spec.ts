import { Test, TestingModule } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UpdateUserStatusUseCase } from 'src/account/use-cases/update-user-status.use-case';
import { ArchiveUserUseCase } from 'src/account/use-cases/archive-user.use-case';
import { GoogleCalendarClient } from '../../google-calendar.client';
import { GoogleCalendarConnectionService } from '../../google-calendar-connection.service';
import { FakeGoogleCalendarClient } from './fake-google-calendar.client';

function fakeIdToken(email: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString(
    'base64url',
  );
  const claims = Buffer.from(JSON.stringify({ email })).toString('base64url');
  return `${header}.${claims}.assinatura`;
}

describe('Google Calendar OAuth flow - Integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let factories: TestFactories;
  let connections: GoogleCalendarConnectionService;
  let updateStatus: UpdateUserStatusUseCase;
  let archiveUser: ArchiveUserUseCase;
  const fakeClient = new FakeGoogleCalendarClient();

  let physician: AuthenticatedUserPayload;

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_OAUTH_REDIRECT_URL =
      'http://localhost:3000/integrations/google-calendar/callback';
    process.env.GOOGLE_WEBHOOK_URL =
      'https://example.test/integrations/google-calendar/webhook';
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY =
      randomBytes(32).toString('base64');
    process.env.FRONTEND_CALENDAR_SETTINGS_URL =
      'http://localhost:5173/configuracoes/agenda';

    await TestDatabaseManager.connect();
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .overrideProvider(GoogleCalendarClient)
      .useValue(fakeClient)
      .compile();
    prisma = module.get(PrismaService);
    connections = module.get(GoogleCalendarConnectionService);
    updateStatus = module.get(UpdateUserStatusUseCase);
    archiveUser = module.get(ArchiveUserUseCase);
    factories = new TestFactories(prisma);
  });

  afterAll(async () => {
    await module.close();
    await TestDatabaseManager.disconnect();
  });

  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();
    fakeClient.reset();
    fakeClient.exchangeResponse = {
      access_token: 'fake-access-token',
      expires_in: 3600,
      refresh_token: 'fake-refresh-token',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      id_token: fakeIdToken('dra.maria@gmail.com'),
    };
    physician =
      await factories.users.createAuthenticatedPhysicianProfessional();
  });

  it('builds the consent URL with sealed state', async () => {
    const { authorizationUrl } =
      await connections.buildAuthorizationUrl(physician);
    const url = new URL(authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('scope')?.split(' ')).toEqual([
      'https://www.googleapis.com/auth/calendar.events',
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
    ]);
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('stores an encrypted connection and creates a watch on callback', async () => {
    const { authorizationUrl } =
      await connections.buildAuthorizationUrl(physician);
    const state = new URL(authorizationUrl).searchParams.get('state')!;

    const redirect = await connections.handleCallback(
      'auth-code',
      state,
      physician.id,
    );
    expect(redirect).toContain('status=connected');

    const connection = await prisma.googleCalendarConnection.findUniqueOrThrow({
      where: { professionalId: physician.professionalId! },
    });
    expect(connection.status).toBe('ACTIVE');
    expect(connection.googleAccountEmail).toBe('dra.maria@gmail.com');
    expect(connection.refreshTokenCiphertext).not.toContain(
      'fake-refresh-token',
    );
    expect(connection.channelId).toBeTruthy();
    expect(connection.channelTokenHash).toHaveLength(64);
    expect(fakeClient.callsTo('watchEvents')).toHaveLength(1);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'GOOGLE_CALENDAR_CONNECTED' },
    });
    expect(audit?.entityId).toBe(physician.professionalId);
  });

  it('redirects with an error code on invalid state', async () => {
    const redirect = await connections.handleCallback(
      'auth-code',
      'lixo',
      physician.id,
    );
    expect(redirect).toContain('status=error');
    expect(redirect).toContain('GOOGLE_OAUTH_STATE_INVALID');
    expect(await prisma.googleCalendarConnection.count()).toBe(0);
  });

  it('rejects a replayed state', async () => {
    const { authorizationUrl } =
      await connections.buildAuthorizationUrl(physician);
    const state = new URL(authorizationUrl).searchParams.get('state')!;

    const first = await connections.handleCallback(
      'auth-code',
      state,
      physician.id,
    );
    expect(first).toContain('status=connected');

    const replay = await connections.handleCallback(
      'auth-code',
      state,
      physician.id,
    );
    expect(replay).toContain('status=error');
    expect(replay).toContain('GOOGLE_OAUTH_STATE_INVALID');
    expect(fakeClient.callsTo('exchangeCode')).toHaveLength(1);
  });

  it('rejects the callback without a browser session', async () => {
    const { authorizationUrl } =
      await connections.buildAuthorizationUrl(physician);
    const state = new URL(authorizationUrl).searchParams.get('state')!;

    const redirect = await connections.handleCallback('auth-code', state, null);
    expect(redirect).toContain('status=error');
    expect(redirect).toContain('GOOGLE_OAUTH_SESSION_INVALID');
    expect(await prisma.googleCalendarConnection.count()).toBe(0);
  });

  it('rejects a state issued to another user', async () => {
    const other =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const { authorizationUrl } = await connections.buildAuthorizationUrl(other);
    const state = new URL(authorizationUrl).searchParams.get('state')!;

    const redirect = await connections.handleCallback(
      'auth-code',
      state,
      physician.id,
    );
    expect(redirect).toContain('status=error');
    expect(redirect).toContain('GOOGLE_OAUTH_SESSION_INVALID');
    expect(await prisma.googleCalendarConnection.count()).toBe(0);
  });

  it('redirects with an error when Google grants no refresh token', async () => {
    fakeClient.exchangeResponse = {
      access_token: 'fake-access-token',
      expires_in: 3600,
    };
    const { authorizationUrl } =
      await connections.buildAuthorizationUrl(physician);
    const state = new URL(authorizationUrl).searchParams.get('state')!;
    const redirect = await connections.handleCallback(
      'auth-code',
      state,
      physician.id,
    );
    expect(redirect).toContain('GOOGLE_REFRESH_TOKEN_MISSING');
  });

  it('rejects a second connect while one is active', async () => {
    const { authorizationUrl } =
      await connections.buildAuthorizationUrl(physician);
    const state = new URL(authorizationUrl).searchParams.get('state')!;
    await connections.handleCallback('auth-code', state, physician.id);

    await expect(connections.buildAuthorizationUrl(physician)).rejects.toThrow(
      ConflictException,
    );
  });

  async function connect(
    target: AuthenticatedUserPayload = physician,
  ): Promise<void> {
    const { authorizationUrl } =
      await connections.buildAuthorizationUrl(target);
    const state = new URL(authorizationUrl).searchParams.get('state')!;
    await connections.handleCallback('auth-code', state, target.id);
  }

  it('enqueues a full resync when reconnecting a broken connection', async () => {
    await connect();
    const connection = await prisma.googleCalendarConnection.findUniqueOrThrow({
      where: { professionalId: physician.professionalId! },
    });
    await prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: { status: 'BROKEN', brokenReason: 'invalid_grant' },
    });

    const patient = await factories.patients.create({
      organizationId: physician.organizationId,
      responsiblePhysicianId: physician.professionalId!,
      createdById: physician.id,
      updatedById: physician.id,
    });
    const appointment = await factories.appointments.create({
      organizationId: physician.organizationId,
      patientId: patient.id,
      professionalId: physician.professionalId!,
      createdById: physician.id,
      updatedById: physician.id,
    });
    await prisma.googleCalendarEventLink.create({
      data: {
        organizationId: physician.organizationId,
        appointmentId: appointment.id,
        connectionId: connection.id,
        googleEventId: 'evt-orfao',
        lastSyncedHash: 'hash-antigo',
      },
    });
    await prisma.calendarSyncJob.deleteMany({});

    await connect();

    const reconnected = await prisma.googleCalendarConnection.findUniqueOrThrow(
      {
        where: { id: connection.id },
      },
    );
    expect(reconnected.status).toBe('ACTIVE');
    expect(reconnected.syncToken).toBeNull();

    const jobs = await prisma.calendarSyncJob.findMany({
      where: { kind: 'PULL_FULL_RESYNC', processedAt: null },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].connectionId).toBe(connection.id);
  });

  it('lets an administrator list the connections of the organization', async () => {
    await connect();
    const admin = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['ADMINISTRATOR'],
    );

    const listed = await connections.listConnections(admin);
    expect(listed).toHaveLength(1);
    expect(listed[0].professionalId).toBe(physician.professionalId);
    expect(listed[0].googleAccountEmail).toBe('dra.maria@gmail.com');
    expect(listed[0].status).toBe('ACTIVE');

    const outsider =
      await factories.users.createAuthenticatedPhysicianProfessional();
    expect(await connections.listConnections(outsider)).toHaveLength(0);
  });

  it('shows only their own connection to a non-administrator', async () => {
    await connect();
    const colleague = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['NURSE'],
    );
    expect(await connections.listConnections(colleague)).toHaveLength(0);
    expect(await connections.listConnections(physician)).toHaveLength(1);
  });

  it('lets an administrator disconnect another professional', async () => {
    await connect();
    const admin = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['ADMINISTRATOR'],
    );

    const result = await connections.disconnectProfessional(
      physician.professionalId!,
      admin,
      false,
    );
    expect(result).toEqual({ disconnected: true });
    expect(await prisma.googleCalendarConnection.count()).toBe(0);
    expect(fakeClient.callsTo('stopChannel')).toHaveLength(1);
    expect(fakeClient.callsTo('revokeToken')).toHaveLength(1);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'GOOGLE_CALENDAR_DISCONNECTED' },
    });
    expect(audit.userId).toBe(admin.id);
    expect(audit.entityId).toBe(physician.professionalId);
  });

  it('refuses to let a colleague disconnect someone else', async () => {
    await connect();
    const colleague = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['NURSE'],
    );

    await expect(
      connections.disconnectProfessional(
        physician.professionalId!,
        colleague,
        false,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(await prisma.googleCalendarConnection.count()).toBe(1);
  });

  it('deactivation flags durable teardown; dispatcher completes it after commit', async () => {
    await connect();
    const admin = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['ADMINISTRATOR'],
    );

    await updateStatus.execute(physician.id, { isActive: false }, admin);
    const flagged = await prisma.googleCalendarConnection.findFirstOrThrow();
    expect(flagged.teardownRequestedAt).not.toBeNull();
    expect(fakeClient.callsTo('revokeToken')).toHaveLength(0);
    const deactivated = await prisma.user.findUniqueOrThrow({
      where: { id: physician.id },
    });
    expect(deactivated.isActive).toBe(false);

    delete process.env.SYSTEM_USER_ID;
    await connections.processPendingTeardowns();
    expect(await prisma.googleCalendarConnection.count()).toBe(1);

    process.env.SYSTEM_USER_ID = admin.id;
    await connections.processPendingTeardowns();
    expect(await prisma.googleCalendarConnection.count()).toBe(0);
    expect(fakeClient.callsTo('revokeToken')).toHaveLength(1);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'GOOGLE_CALENDAR_DISCONNECTED' },
    });
    expect(audit?.userId).toBe(admin.id);
  });

  it('archiving still tears the connection down inline', async () => {
    await connect();
    const admin = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['ADMINISTRATOR'],
    );
    await archiveUser.execute(physician.id, admin);
    expect(await prisma.googleCalendarConnection.count()).toBe(0);
  });

  it('ignores deactivation of a user from another organization', async () => {
    await connect();
    const outsiderAdmin = await factories.users.createAuthenticatedAdmin();

    await updateStatus
      .execute(physician.id, { isActive: false }, outsiderAdmin)
      .catch(() => undefined);
    expect(await prisma.googleCalendarConnection.count()).toBe(1);
  });

  it('disconnects: stops channel, revokes token and audits', async () => {
    const { authorizationUrl } =
      await connections.buildAuthorizationUrl(physician);
    const state = new URL(authorizationUrl).searchParams.get('state')!;
    await connections.handleCallback('auth-code', state, physician.id);

    const result = await connections.disconnect(physician, false);
    expect(result).toEqual({ disconnected: true });
    expect(fakeClient.callsTo('stopChannel')).toHaveLength(1);
    expect(fakeClient.callsTo('revokeToken')).toHaveLength(1);
    expect(await prisma.googleCalendarConnection.count()).toBe(0);
    expect(
      await prisma.auditLog.count({
        where: { action: 'GOOGLE_CALENDAR_DISCONNECTED' },
      }),
    ).toBe(1);

    const status = await connections.status(physician);
    expect(status).toEqual({ connected: false });
  });
});
