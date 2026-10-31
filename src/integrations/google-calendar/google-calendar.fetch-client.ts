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

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

const MAX_RETRY_AFTER_SECONDS = 15 * 60;

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
    const response = await this.send(this.config.revokeEndpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });
    await this.readBody(response);
    if (!response.ok)
      throw new GoogleApiError(
        response.status,
        null,
        this.retryAfter(response),
        `Google revoke endpoint ${response.status}`,
      );
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(this.config.httpTimeoutMs),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : 'unknown';
      throw GoogleApiError.network(
        name === 'TimeoutError' || name === 'AbortError'
          ? `Google request timed out after ${this.config.httpTimeoutMs}ms`
          : `Google request transport failure: ${name}`,
      );
    }
  }

  private async readBody(response: Response): Promise<string> {
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = response.body?.getReader();
    if (!reader) return '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw GoogleApiError.network(
            'Google response body exceeds size limit',
          );
        }
        chunks.push(value);
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : 'unknown';
      throw GoogleApiError.network(`Google response body read failed: ${name}`);
    }
    return Buffer.concat(chunks).toString('utf8');
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
    const response = await this.send(this.config.tokenEndpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...params,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });
    const text = await this.readBody(response);
    let body: Record<string, unknown> = {};
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      if (response.ok) {
        throw GoogleApiError.network(
          'Google token endpoint returned invalid JSON',
        );
      }
    }
    if (!response.ok) {
      throw new GoogleApiError(
        response.status,
        typeof body.error === 'string' ? body.error : null,
        this.retryAfter(response),
        `Google token endpoint ${response.status}`,
      );
    }
    if (
      !body ||
      typeof body.access_token !== 'string' ||
      !body.access_token ||
      typeof body.expires_in !== 'number' ||
      !Number.isFinite(body.expires_in) ||
      body.expires_in <= 0
    ) {
      throw GoogleApiError.network(
        'Google token endpoint returned invalid token fields',
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
    const response = await this.send(
      `${this.config.calendarApiBaseUrl}${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      },
    );
    if (!response.ok) {
      const errorText = await this.readBody(response).catch(() => '');
      let errorBody: {
        error?: { message?: string; errors?: Array<{ reason?: string }> };
      } = {};
      try {
        errorBody = errorText
          ? (JSON.parse(errorText) as typeof errorBody)
          : {};
      } catch {
        errorBody = {};
      }
      throw new GoogleApiError(
        response.status,
        errorBody.error?.errors?.[0]?.reason ?? null,
        this.retryAfter(response),
        errorBody.error?.message ?? `Google Calendar API ${response.status}`,
      );
    }
    const emptyAllowed = method === 'DELETE' || path === '/channels/stop';
    if (response.status === 204 && emptyAllowed) return undefined as T;
    const text = await this.readBody(response);
    if (!text && emptyAllowed) return undefined as T;
    try {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('Invalid object');
      const value = parsed as Record<string, unknown>;
      if (
        !emptyAllowed &&
        method !== 'GET' &&
        (typeof value.id !== 'string' || !value.id)
      )
        throw new Error('Missing id');
      if (
        path.endsWith('/watch') &&
        (typeof value.resourceId !== 'string' || !value.resourceId)
      )
        throw new Error('Missing resourceId');
      if (
        method === 'GET' &&
        value.items !== undefined &&
        !Array.isArray(value.items)
      )
        throw new Error('Invalid items');
      return parsed as T;
    } catch {
      throw GoogleApiError.network('Google Calendar API returned invalid JSON');
    }
  }

  private retryAfter(response: Response): number | null {
    const header = response.headers.get('Retry-After');
    if (!header) return null;
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds, MAX_RETRY_AFTER_SECONDS);
    }
    const date = Date.parse(header);
    if (Number.isFinite(date)) {
      const delta = Math.ceil((date - Date.now()) / 1000);
      if (delta > 0) return Math.min(delta, MAX_RETRY_AFTER_SECONDS);
    }
    return null;
  }
}
