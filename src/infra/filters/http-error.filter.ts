import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainException } from 'src/infra/exceptions/domain.exception';
import { CodedHttpException } from 'src/infra/exceptions/coded.exception';
import {
  codeFromExceptionName,
  defaultCodeForStatus,
  ErrorEnvelope,
  readRequestId,
} from './error-envelope';

interface NestErrorBody {
  message?: string | string[];
  error?: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Envelope único de erro: `{statusCode, code, message, fieldErrors?, requestId?}`.
 * Detalhes internos não atravessam a fronteira HTTP — 5xx responde mensagem
 * genérica e o diagnóstico fica no log correlacionado por requestId.
 */
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const requestId = readRequestId(request);

    const envelope = this.toEnvelope(exception, requestId);

    if (envelope.statusCode >= (HttpStatus.INTERNAL_SERVER_ERROR as number)) {
      this.logger.error(
        `${request.method} ${request.url} failed (requestId=${requestId ?? 'none'})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(envelope.statusCode).json(envelope);
  }

  private toEnvelope(exception: unknown, requestId?: string): ErrorEnvelope {
    if (exception instanceof CodedHttpException) {
      const body = exception.getResponse() as NestErrorBody;
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: this.flatten(body.message) ?? exception.message,
        ...(body.fieldErrors ? { fieldErrors: body.fieldErrors } : {}),
        ...(requestId ? { requestId } : {}),
      };
    }

    if (exception instanceof DomainException) {
      const status = exception.status ?? HttpStatus.BAD_REQUEST;
      return {
        statusCode: status,
        code: codeFromExceptionName(exception.name),
        message: exception.message,
        ...(requestId ? { requestId } : {}),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const body: NestErrorBody =
        typeof raw === 'string' ? { message: raw } : (raw as NestErrorBody);

      const message = this.flatten(body.message) ?? exception.message;
      // Módulos que lançam `new ConflictException('STALE_PROTOCOL_REVISION')`
      // carregam o código na mensagem. Promovê-lo ao campo `code` permite à UI
      // ramificar sem depender do texto.
      const messageIsCode = /^[A-Z][A-Z0-9_]{2,}$/.test(message);

      return {
        statusCode: status,
        code:
          body.code ?? (messageIsCode ? message : defaultCodeForStatus(status)),
        message,
        ...(body.fieldErrors ? { fieldErrors: body.fieldErrors } : {}),
        ...(requestId ? { requestId } : {}),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Erro interno ao processar a requisição.',
      ...(requestId ? { requestId } : {}),
    };
  }

  private flatten(message?: string | string[]): string | undefined {
    if (!message) return undefined;
    return Array.isArray(message) ? message.join(' ') : message;
  }
}
