import { ArgumentsHost, Logger } from '@nestjs/common';
import { createServer, Server } from 'node:http';
import { HttpErrorFilter } from 'src/infra/filters/http-error.filter';
import { GoogleCalendarFetchClient } from 'src/integrations/google-calendar/google-calendar.fetch-client';
import { GoogleCalendarConfig } from 'src/integrations/google-calendar/google-calendar.config';

describe('Aceite independente de redaction (AC-72)', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    'primeira linha\nPRIVATE_SENTINEL',
    'primeira linha\r\nPRIVATE_SENTINEL',
  ])('não registra conteúdo de mensagem multilinha: %s', (message) => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ method: 'POST', get: () => undefined }),
      }),
    } as unknown as ArgumentsHost;
    new HttpErrorFilter().catch(new Error(message), host);
    expect(JSON.stringify(response.json.mock.calls)).not.toContain(
      'PRIVATE_SENTINEL',
    );
    expect(JSON.stringify(logged.mock.calls)).not.toContain('PRIVATE_SENTINEL');
  });

  it('não considera exception.name arbitrário um campo sanitizado', () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const error = new Error('synthetic');
    error.name = 'PRIVATE_SENTINEL';
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    new HttpErrorFilter().catch(error, {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ method: 'POST', get: () => undefined }),
      }),
    } as unknown as ArgumentsHost);
    expect(JSON.stringify(logged.mock.calls)).not.toContain('PRIVATE_SENTINEL');
  });
});

describe('Aceite do cliente Google contra servidor HTTP real (AC-54/56)', () => {
  let server: Server;
  let client: GoogleCalendarFetchClient;
  let status = 200;
  let body = '{}';

  beforeAll(async () => {
    server = createServer((_request, response) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(body);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Missing test port');
    const base = `http://127.0.0.1:${address.port}`;
    client = new GoogleCalendarFetchClient({
      httpTimeoutMs: 500,
      clientId: 'synthetic',
      clientSecret: 'synthetic',
      tokenEndpointUrl: base,
      revokeEndpointUrl: base,
      calendarApiBaseUrl: base,
    } as unknown as GoogleCalendarConfig);
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
  beforeEach(() => {
    status = 200;
    body = '{}';
  });

  it('revogação rejeita HTTP 500 em vez de confirmar sucesso', async () => {
    status = 500;
    await expect(client.revokeToken('synthetic')).rejects.toMatchObject({
      status: 500,
    });
  });
  it('token endpoint não aceita JSON sem access_token/expires_in', async () => {
    await expect(client.refreshAccessToken('synthetic')).rejects.toBeDefined();
  });
  it('insert não aceita sucesso sem identidade do evento', async () => {
    await expect(
      client.insertEvent('synthetic', 'primary', {
        summary: 'Synthetic',
        start: { dateTime: '2026-10-11T12:00:00Z' },
        end: { dateTime: '2026-10-11T13:00:00Z' },
      }),
    ).rejects.toBeDefined();
  });
  it('delete aceita 204 sem body', async () => {
    status = 204;
    await expect(
      client.deleteEvent('synthetic', 'primary', 'synthetic'),
    ).resolves.toBeUndefined();
  });
});
