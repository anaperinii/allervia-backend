export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

export interface GoogleEventDateTime {
  dateTime: string;
  timeZone?: string;
}

export interface GoogleEventPayload {
  id?: string;
  summary?: string;
  description?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
  visibility?: string;
  status?: string;
  extendedProperties?: { private?: Record<string, string> };
}

export interface GoogleEvent extends GoogleEventPayload {
  id: string;
  etag?: string;
  updated?: string;
}

export interface GoogleEventsListResponse {
  items: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export interface GoogleWatchRequest {
  id: string;
  type: 'web_hook';
  address: string;
  token: string;
  params?: { ttl?: string };
}

export interface GoogleWatchResponse {
  id: string;
  resourceId: string;
  expiration?: string;
}

export interface GoogleEventsListQuery {
  syncToken?: string;
  pageToken?: string;
  showDeleted?: boolean;
  maxResults?: number;
}

export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: string | null,
    readonly retryAfterSeconds: number | null,
    message: string,
  ) {
    super(message);
  }

  get isInvalidGrant(): boolean {
    return this.errorCode === 'invalid_grant';
  }

  get isGone(): boolean {
    return this.status === 410;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isRetryable(): boolean {
    if (this.status === 429 || this.status >= 500) return true;

    return (
      this.status === 403 &&
      ['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded'].includes(
        this.errorCode ?? '',
      )
    );
  }

  static network(message: string): GoogleApiError {
    return new GoogleApiError(503, 'network', null, message);
  }
}

export abstract class GoogleCalendarClient {
  abstract exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<GoogleTokenResponse>;

  abstract refreshAccessToken(
    refreshToken: string,
  ): Promise<GoogleTokenResponse>;

  abstract revokeToken(token: string): Promise<void>;

  abstract insertEvent(
    accessToken: string,
    calendarId: string,
    event: GoogleEventPayload,
  ): Promise<GoogleEvent>;

  abstract patchEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: GoogleEventPayload,
  ): Promise<GoogleEvent>;

  abstract deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<void>;

  abstract listEvents(
    accessToken: string,
    calendarId: string,
    query: GoogleEventsListQuery,
  ): Promise<GoogleEventsListResponse>;

  abstract watchEvents(
    accessToken: string,
    calendarId: string,
    request: GoogleWatchRequest,
  ): Promise<GoogleWatchResponse>;

  abstract stopChannel(
    accessToken: string,
    channelId: string,
    resourceId: string,
  ): Promise<void>;
}
