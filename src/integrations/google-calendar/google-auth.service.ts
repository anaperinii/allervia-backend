import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleCalendarConnection } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { GoogleApiError, GoogleCalendarClient } from './google-calendar.client';
import { GoogleTokenBoxService } from './google-token-box.service';

interface CachedToken {
  token: string;
  expiresAt: number;
}

const EXPIRY_MARGIN_MS = 60_000;

@Injectable()
export class GoogleAuthService {
  private readonly cache = new Map<string, CachedToken>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GoogleCalendarClient,
    private readonly tokenBox: GoogleTokenBoxService,
    private readonly audit: IAuditLogService,
    private readonly config: ConfigService,
  ) {}

  async getAccessToken(connection: GoogleCalendarConnection): Promise<string> {
    const cached = this.cache.get(connection.id);
    if (cached && cached.expiresAt > Date.now() + EXPIRY_MARGIN_MS) {
      return cached.token;
    }

    const refreshToken = this.tokenBox.open({
      ciphertext: connection.refreshTokenCiphertext,
      iv: connection.refreshTokenIv,
      authTag: connection.refreshTokenAuthTag,
      keyVersion: connection.keyVersion,
    });

    try {
      const response = await this.client.refreshAccessToken(refreshToken);
      this.cache.set(connection.id, {
        token: response.access_token,
        expiresAt: Date.now() + response.expires_in * 1000,
      });
      return response.access_token;
    } catch (error) {
      if (error instanceof GoogleApiError && error.isInvalidGrant) {
        await this.markBroken(connection.id, 'invalid_grant');
      }
      throw error;
    }
  }

  async markBroken(connectionId: string, reason: string): Promise<void> {
    this.cache.delete(connectionId);
    const updated = await this.prisma.googleCalendarConnection.updateMany({
      where: { id: connectionId, status: 'ACTIVE' },
      data: { status: 'BROKEN', brokenReason: reason },
    });
    if (updated.count === 0) return;

    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { id: connectionId },
      select: { organizationId: true, professionalId: true },
    });
    const systemUserId = this.config.get<string>('SYSTEM_USER_ID')?.trim();
    if (!connection || !systemUserId) return;
    await this.audit.record({
      userId: systemUserId,
      organizationId: connection.organizationId,
      entityType: 'Professional',
      entityId: connection.professionalId,
      action: 'GOOGLE_CALENDAR_CONNECTION_BROKEN',
      newValues: { reason },
    });
  }

  evict(connectionId: string): void {
    this.cache.delete(connectionId);
  }
}
