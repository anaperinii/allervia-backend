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

    const redirect = await connections.handleCallback('auth-code', state);
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
    const redirect = await connections.handleCallback('auth-code', 'lixo');
    expect(redirect).toContain('status=error');
    expect(redirect).toContain('GOOGLE_OAUTH_STATE_INVALID');
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
    const redirect = await connections.handleCallback('auth-code', state);
    expect(redirect).toContain('GOOGLE_REFRESH_TOKEN_MISSING');
  });

  it('rejects a second connect while one is active', async () => {
    const { authorizationUrl } =
      await connections.buildAuthorizationUrl(physician);
    const state = new URL(authorizationUrl).searchParams.get('state')!;
    await connections.handleCallback('auth-code', state);

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
    await connections.handleCallback('auth-code', state);
  }

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

  it('disconnects when a user is deactivated or archived', async () => {
    await connect();
    const admin = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['ADMINISTRATOR'],
    );

    await updateStatus.execute(physician.id, { isActive: false }, admin);
    expect(await prisma.googleCalendarConnection.count()).toBe(0);
    expect(fakeClient.callsTo('revokeToken')).toHaveLength(1);

    await connect();
    expect(await prisma.googleCalendarConnection.count()).toBe(1);
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
    await connections.handleCallback('auth-code', state);

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
