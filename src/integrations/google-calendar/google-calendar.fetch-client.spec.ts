import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { GoogleCalendarConfig } from './google-calendar.config';
import { GoogleCalendarFetchClient } from './google-calendar.fetch-client';
import { GoogleApiError } from './google-calendar.client';

type Handler = Parameters<typeof createServer>[1];

describe('GoogleCalendarFetchClient contra servidor HTTP controlado', () => {
  let server: Server;
  let baseUrl: string;
  let handler: Handler;

  function buildClient(timeoutMs: number): GoogleCalendarFetchClient {
    const env: Record<string, string> = {
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
      GOOGLE_HTTP_TIMEOUT_MS: String(timeoutMs),
      GOOGLE_TOKEN_URL: `${baseUrl}/token`,
      GOOGLE_REVOKE_URL: `${baseUrl}/revoke`,
      GOOGLE_CALENDAR_API_BASE_URL: baseUrl,
    };
    const config = new GoogleCalendarConfig({
      get: (key: string) => env[key],
    } as unknown as ConfigService);
    return new GoogleCalendarFetchClient(config);
  }

  beforeAll(async () => {
    server = createServer((req, res) => handler!(req, res));
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('aborta conexão que nunca responde dentro do deadline', async () => {
    handler = () => {};
    const client = buildClient(1_000);
    const started = Date.now();
    await expect(client.listEvents('tok', 'primary', {})).rejects.toMatchObject(
      { errorCode: 'network' },
    );
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('aborta body que nunca termina (gotejamento)', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('{"items":[');
    };
    const client = buildClient(1_000);
    await expect(client.listEvents('tok', 'primary', {})).rejects.toMatchObject(
      { errorCode: 'network' },
    );
  });

  it('JSON inválido em resposta 200 vira erro de rede retryable, sem persistir lixo', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('isto não é json');
    };
    const client = buildClient(2_000);
    const error = (await client
      .listEvents('tok', 'primary', {})
      .catch((e: GoogleApiError) => e)) as GoogleApiError;
    expect(error).toBeInstanceOf(GoogleApiError);
    expect(error.isRetryable).toBe(true);
  });

  it('204 é aceito sem body', async () => {
    handler = (_req, res) => {
      res.writeHead(204);
      res.end();
    };
    const client = buildClient(2_000);
    await expect(
      client.deleteEvent('tok', 'primary', 'evt1'),
    ).resolves.toBeUndefined();
  });

  it('classifica 403 por reason: rate limit é retryable; permissão não é', async () => {
    const respond = (reason: string): Handler =>
      ((_req, res) => {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: { message: 'x', errors: [{ reason }] } }),
        );
      }) as Handler;

    const client = buildClient(2_000);

    handler = respond('rateLimitExceeded');
    const rateLimited = (await client
      .listEvents('tok', 'primary', {})
      .catch((e: GoogleApiError) => e)) as GoogleApiError;
    expect(rateLimited.isRetryable).toBe(true);

    handler = respond('insufficientPermissions');
    const forbidden = (await client
      .listEvents('tok', 'primary', {})
      .catch((e: GoogleApiError) => e)) as GoogleApiError;
    expect(forbidden.isRetryable).toBe(false);
  });

  it('Retry-After aceita segundos e data HTTP, com teto', async () => {
    const client = buildClient(2_000);

    handler = (_req, res) => {
      res.writeHead(429, { 'Retry-After': '30' });
      res.end('{}');
    };
    const seconds = (await client
      .listEvents('tok', 'primary', {})
      .catch((e: GoogleApiError) => e)) as GoogleApiError;
    expect(seconds.retryAfterSeconds).toBe(30);

    handler = (_req, res) => {
      res.writeHead(429, {
        'Retry-After': new Date(Date.now() + 60_000).toUTCString(),
      });
      res.end('{}');
    };
    const httpDate = (await client
      .listEvents('tok', 'primary', {})
      .catch((e: GoogleApiError) => e)) as GoogleApiError;
    expect(httpDate.retryAfterSeconds).toBeGreaterThanOrEqual(55);
    expect(httpDate.retryAfterSeconds).toBeLessThanOrEqual(60);

    handler = (_req, res) => {
      res.writeHead(429, { 'Retry-After': '99999' });
      res.end('{}');
    };
    const absurd = (await client
      .listEvents('tok', 'primary', {})
      .catch((e: GoogleApiError) => e)) as GoogleApiError;
    expect(absurd.retryAfterSeconds).toBe(15 * 60);
  });

  it('token endpoint também respeita o deadline', async () => {
    handler = () => {};
    const client = buildClient(1_000);
    await expect(client.refreshAccessToken('rt')).rejects.toMatchObject({
      errorCode: 'network',
    });
  });
});
