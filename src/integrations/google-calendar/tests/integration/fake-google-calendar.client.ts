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
} from '../../google-calendar.client';

export class FakeGoogleCalendarClient extends GoogleCalendarClient {
  calls: Array<{ method: string; args: unknown[] }> = [];
  events = new Map<string, GoogleEvent>();
  listPages: GoogleEventsListResponse[] = [];
  nextError: GoogleApiError | null = null;
  refreshError: GoogleApiError | null = null;
  exchangeResponse: GoogleTokenResponse = {
    access_token: 'fake-access-token',
    expires_in: 3600,
    refresh_token: 'fake-refresh-token',
    scope: 'https://www.googleapis.com/auth/calendar.events',
  };
  private sequence = 0;

  reset(): void {
    this.calls = [];
    this.events.clear();
    this.listPages = [];
    this.nextError = null;
    this.refreshError = null;
    this.sequence = 0;
  }

  callsTo(method: string): Array<{ method: string; args: unknown[] }> {
    return this.calls.filter((call) => call.method === method);
  }

  private record(method: string, args: unknown[]): void {
    this.calls.push({ method, args });
  }

  private consumeError(): void {
    if (this.nextError) {
      const error = this.nextError;
      this.nextError = null;
      throw error;
    }
  }

  exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<GoogleTokenResponse> {
    this.record('exchangeCode', [code, redirectUri]);
    this.consumeError();
    return Promise.resolve(this.exchangeResponse);
  }

  refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    this.record('refreshAccessToken', [refreshToken]);
    if (this.refreshError) throw this.refreshError;
    return Promise.resolve({
      access_token: 'fake-access-token',
      expires_in: 3600,
    });
  }

  revokeToken(token: string): Promise<void> {
    this.record('revokeToken', [token]);
    return Promise.resolve();
  }

  insertEvent(
    _accessToken: string,
    calendarId: string,
    event: GoogleEventPayload,
  ): Promise<GoogleEvent> {
    this.record('insertEvent', [calendarId, event]);
    this.consumeError();
    this.sequence += 1;
    const created: GoogleEvent = {
      ...event,
      id: `evt-${this.sequence}`,
      etag: `"etag-${this.sequence}"`,
    };
    this.events.set(created.id, created);
    return Promise.resolve(created);
  }

  patchEvent(
    _accessToken: string,
    calendarId: string,
    eventId: string,
    event: GoogleEventPayload,
  ): Promise<GoogleEvent> {
    this.record('patchEvent', [calendarId, eventId, event]);
    this.consumeError();
    const existing = this.events.get(eventId);
    if (!existing) {
      throw new GoogleApiError(404, null, null, 'not found');
    }
    this.sequence += 1;
    const patched: GoogleEvent = {
      ...existing,
      ...event,
      id: eventId,
      etag: `"etag-${this.sequence}"`,
    };
    this.events.set(eventId, patched);
    return Promise.resolve(patched);
  }

  deleteEvent(
    _accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<void> {
    this.record('deleteEvent', [calendarId, eventId]);
    this.consumeError();
    this.events.delete(eventId);
    return Promise.resolve();
  }

  listEvents(
    _accessToken: string,
    calendarId: string,
    query: GoogleEventsListQuery,
  ): Promise<GoogleEventsListResponse> {
    this.record('listEvents', [calendarId, query]);
    this.consumeError();
    const page = this.listPages.shift();
    return Promise.resolve(
      page ?? { items: [], nextSyncToken: 'sync-token-next' },
    );
  }

  watchEvents(
    _accessToken: string,
    calendarId: string,
    request: GoogleWatchRequest,
  ): Promise<GoogleWatchResponse> {
    this.record('watchEvents', [calendarId, request]);
    this.consumeError();
    return Promise.resolve({
      id: request.id,
      resourceId: `resource-${request.id}`,
      expiration: String(Date.now() + 6 * 24 * 3_600_000),
    });
  }

  stopChannel(
    _accessToken: string,
    channelId: string,
    resourceId: string,
  ): Promise<void> {
    this.record('stopChannel', [channelId, resourceId]);
    return Promise.resolve();
  }
}
