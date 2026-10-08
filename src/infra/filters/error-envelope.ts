import { HttpStatus } from '@nestjs/common';
import type { Request } from 'express';

export interface ErrorEnvelope {
  statusCode: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
}

const CODE_BY_STATUS: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.GONE]: 'ENDPOINT_RETIRED',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_CONTENT_TYPE',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_ATTEMPTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

export function defaultCodeForStatus(status: number): string {
  return CODE_BY_STATUS[status as HttpStatus] ?? 'INTERNAL_ERROR';
}

export function codeFromExceptionName(name: string): string {
  return name
    .replace(/Exception$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase();
}

export function readRequestId(request: Request): string | undefined {
  const fromContext = (request as Request & { requestId?: string }).requestId;
  if (fromContext) return fromContext;
  const header = request.get('x-request-id');
  return header ?? undefined;
}
