import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { GoogleCalendarConnection } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import {
  GoogleApiError,
  GoogleCalendarClient,
  GoogleTokenResponse,
} from './google-calendar.client';
import {
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_OAUTH_SCOPES,
  GoogleCalendarConfig,
} from './google-calendar.config';
import { GoogleTokenBoxService } from './google-token-box.service';
import { OAuthStateService } from './oauth-state.service';
import { ChannelLifecycleService } from './channel-lifecycle.service';
import { GoogleAuthService } from './google-auth.service';
import { MAX_ATTEMPTS } from './calendar-sync.service';

const AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,}$/;

@Injectable()
export class GoogleCalendarConnectionService {
  private readonly logger = new Logger(GoogleCalendarConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: IAuditLogService,
    private readonly config: GoogleCalendarConfig,
    private readonly tokenBox: GoogleTokenBoxService,
    private readonly oauthState: OAuthStateService,
    private readonly client: GoogleCalendarClient,
    private readonly channels: ChannelLifecycleService,
    private readonly auth: GoogleAuthService,
    private readonly abilities: AbilityFactory,
  ) {}

  async buildAuthorizationUrl(
    user: AuthenticatedUserPayload,
  ): Promise<{ authorizationUrl: string }> {
    const professionalId = this.requireProfessional(user);
    const clientId = this.config.clientId;
    const redirectUri = this.config.oauthRedirectUrl;
    if (!clientId || !redirectUri || !this.tokenBox.available) {
      throw new ServiceUnavailableException('GOOGLE_TOKEN_KEY_UNAVAILABLE');
    }

    const existing = await this.prisma.googleCalendarConnection.findUnique({
      where: { professionalId },
      select: { status: true },
    });
    if (existing?.status === 'ACTIVE') {
      throw new ConflictException('GOOGLE_CALENDAR_ALREADY_CONNECTED');
    }

    const state = this.oauthState.seal({
      userId: user.id,
      professionalId,
      organizationId: user.organizationId,
    });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_OAUTH_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return { authorizationUrl: `${AUTHORIZATION_URL}?${params.toString()}` };
  }

  async handleCallback(code: string, state: string): Promise<string> {
    const settingsUrl = this.config.frontendSettingsUrl;
    try {
      const payload = this.oauthState.open(state);
      const redirectUri = this.config.oauthRedirectUrl;
      if (!redirectUri) {
        throw new ServiceUnavailableException('GOOGLE_TOKEN_KEY_UNAVAILABLE');
      }

      let tokens: GoogleTokenResponse;
      try {
        tokens = await this.client.exchangeCode(code, redirectUri);
      } catch {
        throw new ServiceUnavailableException('GOOGLE_OAUTH_EXCHANGE_FAILED');
      }
      if (!tokens.refresh_token) {
        throw new BadRequestException('GOOGLE_REFRESH_TOKEN_MISSING');
      }
      if (
        tokens.scope &&
        !tokens.scope.split(' ').includes(GOOGLE_CALENDAR_SCOPE)
      ) {
        throw new BadRequestException('GOOGLE_SCOPE_NOT_GRANTED');
      }

      const sealed = this.tokenBox.seal(tokens.refresh_token);
      const email = this.emailFromIdToken(tokens.id_token) ?? 'desconhecido';

      const connection = await this.prisma.googleCalendarConnection.upsert({
        where: { professionalId: payload.professionalId },
        create: {
          organizationId: payload.organizationId,
          professionalId: payload.professionalId,
          googleAccountEmail: email,
          grantedScopes: tokens.scope ?? GOOGLE_CALENDAR_SCOPE,
          refreshTokenCiphertext: sealed.ciphertext,
          refreshTokenIv: sealed.iv,
          refreshTokenAuthTag: sealed.authTag,
          keyVersion: sealed.keyVersion,
        },
        update: {
          googleAccountEmail: email,
          grantedScopes: tokens.scope ?? GOOGLE_CALENDAR_SCOPE,
          refreshTokenCiphertext: sealed.ciphertext,
          refreshTokenIv: sealed.iv,
          refreshTokenAuthTag: sealed.authTag,
          keyVersion: sealed.keyVersion,
          status: 'ACTIVE',
          brokenReason: null,
          syncToken: null,
        },
      });
      this.auth.evict(connection.id);

      await this.audit.record({
        userId: payload.userId,
        organizationId: payload.organizationId,
        entityType: 'Professional',
        entityId: payload.professionalId,
        action: 'GOOGLE_CALENDAR_CONNECTED',
        newValues: { googleAccountEmail: email },
      });

      try {
        await this.channels.ensureChannel(connection);
      } catch (error) {
        this.logger.warn(
          `watch channel creation failed for connection ${connection.id}: ${String(error)}`,
        );
      }

      return this.redirectUrl(settingsUrl, 'connected');
    } catch (error) {
      const message = error instanceof HttpException ? error.message : '';
      const code = CODE_PATTERN.test(message)
        ? message
        : 'GOOGLE_OAUTH_EXCHANGE_FAILED';
      return this.redirectUrl(settingsUrl, 'error', code);
    }
  }

  async status(user: AuthenticatedUserPayload) {
    const professionalId = this.requireProfessional(user);
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { professionalId },
    });
    if (!connection) return { connected: false };

    const jobScope = {
      OR: [
        { connectionId: connection.id },
        { appointment: { professionalId } },
      ],
    };
    const [pendingJobs, deadLetteredJobs] = await this.prisma.$transaction([
      this.prisma.calendarSyncJob.count({
        where: {
          ...jobScope,
          processedAt: null,
          attempts: { lt: MAX_ATTEMPTS },
        },
      }),
      this.prisma.calendarSyncJob.count({
        where: { ...jobScope, attempts: { gte: MAX_ATTEMPTS } },
      }),
    ]);

    return {
      connected: true,
      googleAccountEmail: connection.googleAccountEmail,
      status: connection.status,
      brokenReason: connection.brokenReason,
      channelExpiresAt: connection.channelExpiresAt,
      lastIncrementalSyncAt: connection.lastIncrementalSyncAt,
      pendingJobs,
      deadLetteredJobs,
    };
  }

  async listConnections(user: AuthenticatedUserPayload) {
    const ability = this.abilities.createForUser(user);
    if (!ability.can('read', 'GoogleCalendarConnection')) return [];
    const connections = await this.prisma.googleCalendarConnection.findMany({
      where: {
        AND: [
          { organizationId: user.organizationId },
          accessibleBy(ability, 'read').ofType('GoogleCalendarConnection'),
        ],
      },
      select: {
        professionalId: true,
        googleAccountEmail: true,
        status: true,
        brokenReason: true,
        channelExpiresAt: true,
        lastIncrementalSyncAt: true,
        createdAt: true,
        professional: {
          select: { id: true, fullName: true, profession: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return connections;
  }

  async disconnect(
    user: AuthenticatedUserPayload,
    removeEvents: boolean,
  ): Promise<{ disconnected: true }> {
    const professionalId = this.requireProfessional(user);
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { professionalId },
    });
    if (!connection) {
      throw new NotFoundException('GOOGLE_CALENDAR_NOT_CONNECTED');
    }
    await this.teardown(connection, user.id, removeEvents);
    return { disconnected: true };
  }

  async disconnectProfessional(
    targetProfessionalId: string,
    user: AuthenticatedUserPayload,
    removeEvents: boolean,
  ): Promise<{ disconnected: true }> {
    const ability = this.abilities.createForUser(user);
    if (!ability.can('manage', 'GoogleCalendarConnection')) {
      throw new NotFoundException('GOOGLE_CALENDAR_NOT_CONNECTED');
    }
    const connection = await this.prisma.googleCalendarConnection.findFirst({
      where: {
        AND: [
          {
            professionalId: targetProfessionalId,
            organizationId: user.organizationId,
          },
          accessibleBy(ability, 'manage').ofType('GoogleCalendarConnection'),
        ],
      },
    });
    if (!connection) {
      throw new NotFoundException('GOOGLE_CALENDAR_NOT_CONNECTED');
    }
    await this.teardown(connection, user.id, removeEvents);
    return { disconnected: true };
  }

  async disconnectByUserId(
    userId: string,
    actor: { id: string; organizationId: string },
  ): Promise<void> {
    const professional = await this.prisma.professional.findUnique({
      where: { userId },
      select: { id: true, organizationId: true },
    });
    if (!professional || professional.organizationId !== actor.organizationId) {
      return;
    }
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { professionalId: professional.id },
    });
    if (!connection) return;
    await this.teardown(connection, actor.id, false);
  }

  private async teardown(
    connection: GoogleCalendarConnection,
    actorUserId: string,
    removeEvents: boolean,
  ): Promise<void> {
    await this.channels.stopConnectionChannel(connection);

    if (removeEvents && connection.status === 'ACTIVE') {
      await this.removeFutureEvents(connection.id);
    }

    try {
      const refreshToken = this.tokenBox.open({
        ciphertext: connection.refreshTokenCiphertext,
        iv: connection.refreshTokenIv,
        authTag: connection.refreshTokenAuthTag,
        keyVersion: connection.keyVersion,
      });
      await this.client.revokeToken(refreshToken);
    } catch {
      this.logger.warn(
        `token revoke failed for connection ${connection.id}; proceeding`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.calendarSyncJob.deleteMany({
        where: {
          processedAt: null,
          OR: [
            { connectionId: connection.id },
            { appointment: { professionalId: connection.professionalId } },
          ],
        },
      });
      await tx.googleCalendarEventLink.deleteMany({
        where: { connectionId: connection.id },
      });
      await tx.googleCalendarConnection.delete({
        where: { id: connection.id },
      });
      await this.audit.record(
        {
          userId: actorUserId,
          organizationId: connection.organizationId,
          entityType: 'Professional',
          entityId: connection.professionalId,
          action: 'GOOGLE_CALENDAR_DISCONNECTED',
          oldValues: { googleAccountEmail: connection.googleAccountEmail },
        },
        tx,
      );
    });
    this.auth.evict(connection.id);
  }

  private async removeFutureEvents(connectionId: string): Promise<void> {
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { id: connectionId },
    });
    if (!connection) return;
    const links = await this.prisma.googleCalendarEventLink.findMany({
      where: {
        connectionId,
        deletedAt: null,
        appointment: { status: 'SCHEDULED', startsAt: { gt: new Date() } },
      },
      take: 200,
    });
    if (!links.length) return;
    try {
      const accessToken = await this.auth.getAccessToken(connection);
      for (const link of links) {
        try {
          await this.client.deleteEvent(
            accessToken,
            connection.calendarId,
            link.googleEventId,
          );
        } catch (error) {
          if (error instanceof GoogleApiError && error.isNotFound) continue;
          this.logger.warn(
            `event cleanup failed for link ${link.id}: ${String(error)}`,
          );
        }
      }
    } catch {
      this.logger.warn(
        `event cleanup skipped for connection ${connectionId}: token unavailable`,
      );
    }
  }

  private emailFromIdToken(idToken: string | undefined): string | null {
    if (!idToken) return null;
    const segments = idToken.split('.');
    if (segments.length < 2) return null;
    try {
      const claims = JSON.parse(
        Buffer.from(segments[1], 'base64url').toString('utf8'),
      ) as { email?: string };
      return typeof claims.email === 'string' ? claims.email : null;
    } catch {
      return null;
    }
  }

  private requireProfessional(user: AuthenticatedUserPayload): string {
    if (!user.professionalId) {
      throw new NotFoundException('GOOGLE_CALENDAR_NOT_CONNECTED');
    }
    return user.professionalId;
  }

  private redirectUrl(base: string, status: string, code?: string): string {
    const separator = base.includes('?') ? '&' : '?';
    const params = new URLSearchParams({ status });
    if (code) params.set('code', code);
    return `${base}${separator}${params.toString()}`;
  }
}
