import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GoogleCalendarConfig } from './google-calendar.config';
import {
  GoogleApiError,
  GoogleCalendarClient,
  GoogleEvent,
  GoogleEventPayload,
  GoogleEventsListQuery,
  GoogleEventsListResponse,
  GoogleTokenResponse,
  GoogleWatchRequest,
  GoogleWatchResponse,
} from './google-calendar.client';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

@Injectable()
export class GoogleCalendarFetchClient extends GoogleCalendarClient {
  constructor(private readonly config: GoogleCalendarConfig) {
    super();
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<GoogleTokenResponse> {
    return this.tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    return this.tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  async revokeToken(token: string): Promise<void> {
    await fetch(REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });
  }

  async insertEvent(
    accessToken: string,
    calendarId: string,
    event: GoogleEventPayload,
  ): Promise<GoogleEvent> {
    return this.calendarRequest<GoogleEvent>(
      accessToken,
      'POST',
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      event,
    );
  }

  async patchEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: GoogleEventPayload,
  ): Promise<GoogleEvent> {
    return this.calendarRequest<GoogleEvent>(
      accessToken,
      'PATCH',
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      event,
    );
  }

  async deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<void> {
    await this.calendarRequest<void>(
      accessToken,
      'DELETE',
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    );
  }

  async listEvents(
    accessToken: string,
    calendarId: string,
    query: GoogleEventsListQuery,
  ): Promise<GoogleEventsListResponse> {
    const params = new URLSearchParams();
    if (query.syncToken) params.set('syncToken', query.syncToken);
    if (query.pageToken) params.set('pageToken', query.pageToken);
    if (query.showDeleted) params.set('showDeleted', 'true');
    if (query.maxResults) params.set('maxResults', String(query.maxResults));
    params.set('singleEvents', 'true');
    return this.calendarRequest<GoogleEventsListResponse>(
      accessToken,
      'GET',
      `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    );
  }

  async watchEvents(
    accessToken: string,
    calendarId: string,
    request: GoogleWatchRequest,
  ): Promise<GoogleWatchResponse> {
    return this.calendarRequest<GoogleWatchResponse>(
      accessToken,
      'POST',
      `/calendars/${encodeURIComponent(calendarId)}/events/watch`,
      request,
    );
  }

  async stopChannel(
    accessToken: string,
    channelId: string,
    resourceId: string,
  ): Promise<void> {
    await this.calendarRequest<void>(accessToken, 'POST', '/channels/stop', {
      id: channelId,
      resourceId,
    });
  }

  private async tokenRequest(
    params: Record<string, string>,
  ): Promise<GoogleTokenResponse> {
    const clientId = this.config.clientId;
    const clientSecret = this.config.clientSecret;
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('GOOGLE_TOKEN_KEY_UNAVAILABLE');
    }
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...params,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok) {
      throw new GoogleApiError(
        response.status,
        typeof body.error === 'string' ? body.error : null,
        this.retryAfter(response),
        `Google token endpoint ${response.status}`,
      );
    }
    return body as unknown as GoogleTokenResponse;
  }

  private async calendarRequest<T>(
    accessToken: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${CALENDAR_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as {
        error?: { message?: string; errors?: Array<{ reason?: string }> };
      };
      throw new GoogleApiError(
        response.status,
        errorBody.error?.errors?.[0]?.reason ?? null,
        this.retryAfter(response),
        errorBody.error?.message ?? `Google Calendar API ${response.status}`,
      );
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  private retryAfter(response: Response): number | null {
    const header = response.headers.get('Retry-After');
    if (!header) return null;
    const seconds = Number(header);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }
}
