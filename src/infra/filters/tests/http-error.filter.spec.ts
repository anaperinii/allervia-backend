import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { HttpErrorFilter } from '../http-error.filter';
import { ErrorEnvelope } from '../error-envelope';
import { CodedHttpException } from 'src/infra/exceptions/coded.exception';
import { ERROR_MESSAGES } from 'src/infra/errors/error-catalog';

function capture(exception: unknown): ErrorEnvelope {
  let envelope: ErrorEnvelope | undefined;
  const response = {
    status: () => response,
    json: (body: ErrorEnvelope) => {
      envelope = body;
      return response;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({
        method: 'POST',
        url: '/test',
        get: () => undefined,
      }),
    }),
  } as unknown as ArgumentsHost;

  new HttpErrorFilter().catch(exception, host);
  return envelope!;
}

describe('HttpErrorFilter', () => {
  it('traduz códigos de domínio para copy em português', () => {
    const envelope = capture(
      new ConflictException('ADMINISTRATION_BEFORE_INDUCTION_START'),
    );

    expect(envelope.statusCode).toBe(HttpStatus.CONFLICT);
    expect(envelope.code).toBe('ADMINISTRATION_BEFORE_INDUCTION_START');
    expect(envelope.message).toBe(
      ERROR_MESSAGES.ADMINISTRATION_BEFORE_INDUCTION_START,
    );
  });

  it('traduz a mensagem padrão do Nest quando nenhuma é informada', () => {
    const envelope = capture(new NotFoundException());

    expect(envelope.code).toBe('NOT_FOUND');
    expect(envelope.message).toBe(ERROR_MESSAGES.NOT_FOUND);
  });

  it('preserva mensagens de domínio já escritas em português', () => {
    const envelope = capture(new BadRequestException('CPF já cadastrado.'));

    expect(envelope.code).toBe('BAD_REQUEST');
    expect(envelope.message).toBe('CPF já cadastrado.');
  });

  it('preserva a mensagem e os fieldErrors de CodedHttpException', () => {
    const envelope = capture(
      new CodedHttpException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        ERROR_MESSAGES.VALIDATION_ERROR,
        { birthDate: ['Data inválida.'] },
      ),
    );

    expect(envelope.code).toBe('VALIDATION_ERROR');
    expect(envelope.message).toBe(ERROR_MESSAGES.VALIDATION_ERROR);
    expect(envelope.fieldErrors).toEqual({ birthDate: ['Data inválida.'] });
  });

  it('mantém o código bruto quando não há copy cadastrada', () => {
    const envelope = capture(new ConflictException('CODIGO_SEM_CATALOGO'));

    expect(envelope.code).toBe('CODIGO_SEM_CATALOGO');
    expect(envelope.message).toBe('CODIGO_SEM_CATALOGO');
  });

  it('devolve INTERNAL_ERROR para exceções desconhecidas', () => {
    const envelope = capture(new Error('boom'));

    expect(envelope.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(envelope.code).toBe('INTERNAL_ERROR');
    expect(envelope.message).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
  });
});
