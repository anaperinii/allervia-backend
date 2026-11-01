import { ArgumentsHost, Logger } from '@nestjs/common';
import { HttpErrorFilter } from 'src/infra/filters/http-error.filter';

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
