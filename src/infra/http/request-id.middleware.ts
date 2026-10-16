import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ulid } from 'ulid';

export interface RequestWithId extends Request {
  requestId?: string;
}

const HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HttpRequest');
  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const incoming = request.get(HEADER);
    const requestId =
      incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : ulid();

    request.requestId = requestId;
    response.setHeader(HEADER, requestId);
    response.setHeader('Cache-Control', 'no-store');

    const metricsLog =
      process.env.HTTP_METRICS_LOG ??
      (process.env.NODE_ENV === 'production' ? 'true' : 'false');
    if (metricsLog === 'true') {
      const started = performance.now();
      response.once('finish', () => {
        const route = request.route as { path?: unknown } | undefined;
        this.logger.log(
          JSON.stringify({
            event: 'http_request',
            requestId,
            method: request.method,

            route: typeof route?.path === 'string' ? route.path : 'unmatched',
            status: response.statusCode,
            durationMs: Math.round(performance.now() - started),
          }),
        );
      });
    }
    next();
  }
}
