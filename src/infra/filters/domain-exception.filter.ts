import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainException } from 'src/infra/exceptions/domain.exception';
import {
  codeFromExceptionName,
  ErrorEnvelope,
  readRequestId,
} from './error-envelope';

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const status = exception.status ?? HttpStatus.BAD_REQUEST;
    const requestId = readRequestId(request);

    const envelope: ErrorEnvelope = {
      statusCode: status,
      code: codeFromExceptionName(exception.name),
      message: exception.message,
      ...(requestId ? { requestId } : {}),
    };

    response.status(status).json(envelope);
  }
}
