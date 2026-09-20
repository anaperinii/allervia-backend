import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ulid } from 'ulid';

export interface RequestWithId extends Request {
  requestId?: string;
}

const HEADER = 'x-request-id';
/** Aceita apenas correlação simples vinda do gateway; nunca ecoa entrada livre. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Correlação de logs e respostas de erro. O identificador não carrega dado
 * clínico nem de identidade: serve para localizar a requisição nos registros.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const incoming = request.get(HEADER);
    const requestId =
      incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : ulid();

    request.requestId = requestId;
    response.setHeader(HEADER, requestId);
    next();
  }
}
