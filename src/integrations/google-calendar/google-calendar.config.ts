import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const GOOGLE_CALENDAR_SCOPE =
  'https://www.googleapis.com/auth/calendar.events';

export const GOOGLE_OAUTH_SCOPES = [
  GOOGLE_CALENDAR_SCOPE,
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

@Injectable()
export class GoogleCalendarConfig {
  constructor(private readonly configService: ConfigService) {}

  get enabled(): boolean {
    return Boolean(
      this.clientId &&
        this.clientSecret &&
        this.oauthRedirectUrl &&
        this.tokenEncryptionKey,
    );
  }

  get clientId(): string | null {
    return this.configService.get<string>('GOOGLE_CLIENT_ID') ?? null;
  }

  get clientSecret(): string | null {
    return this.configService.get<string>('GOOGLE_CLIENT_SECRET') ?? null;
  }

  get oauthRedirectUrl(): string | null {
    return this.configService.get<string>('GOOGLE_OAUTH_REDIRECT_URL') ?? null;
  }

  get webhookUrl(): string | null {
    return this.configService.get<string>('GOOGLE_WEBHOOK_URL') ?? null;
  }

  get frontendSettingsUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_CALENDAR_SETTINGS_URL') ??
      this.configService.get<string>('APP_BASE_URL') ??
      '/'
    );
  }

  get tokenEncryptionKey(): Buffer | null {
    const configured = this.configService.get<string>(
      'GOOGLE_TOKEN_ENCRYPTION_KEY',
    );
    if (!configured) return null;
    const key = Buffer.from(configured, 'base64');
    return key.length === 32 ? key : null;
  }

  get oauthStateTtlMs(): number {
    return this.positiveNumber('GOOGLE_OAUTH_STATE_TTL_MINUTES', 10) * 60_000;
  }

  private positiveNumber(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    if (raw === undefined || raw === null || raw === '') return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
