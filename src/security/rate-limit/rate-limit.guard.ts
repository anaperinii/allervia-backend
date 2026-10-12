import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { CodedTooManyRequestsException } from 'src/infra/exceptions/coded.exception';
import { messageForCode } from 'src/infra/errors/error-catalog';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { hashIdentifier } from 'src/security/session/session.crypto';
import {
  RATE_LIMIT_KEY,
  RateLimitKeyPart,
  RateLimitOptions,
} from './rate-limit.decorator';
import { RateLimitConfig } from './rate-limit.config';
import { RateLimitService } from './rate-limit.service';

const DEFAULT_KEY_PARTS: RateLimitKeyPart[] = ['ip', 'user', 'organization'];

type RateLimitedRequest = Request & { user?: AuthenticatedUserPayload };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
    private readonly config: RateLimitConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<
      RateLimitOptions | undefined
    >(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);

    if (!options) return true;

    const policy = this.config.forClass(options.class);
    const limit = options.limit ?? policy?.limit;
    const windowSeconds = options.windowSeconds ?? policy?.windowSeconds;

    if (!limit || !windowSeconds) {
      this.logger.warn(
        `Rate limit class without policy or overrides; skipping (class=${options.class})`,
      );
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<RateLimitedRequest>();
    const response = http.getResponse<Response>();

    const result = await this.rateLimitService.consume({
      class: options.class,
      key: this.buildKey(options, request),
      limit,
      windowSeconds,
      failOpen: policy?.failOpen ?? false,
    });

    if (result.allowed) return true;

    if (result.retryAfterSeconds) {
      response.setHeader('Retry-After', String(result.retryAfterSeconds));
    }
    throw new CodedTooManyRequestsException(
      'RATE_LIMITED',
      messageForCode('RATE_LIMITED')!,
    );
  }

  private buildKey(
    options: RateLimitOptions,
    request: RateLimitedRequest,
  ): string {
    const parts = options.keyBy ?? DEFAULT_KEY_PARTS;
    const user = request.user;
    const values: string[] = [];

    if (parts.includes('ip')) {
      values.push(`ip:${request.ip ?? 'unknown'}`);
    }
    if (parts.includes('user') && user) {
      values.push(`user:${user.id}`);
    }
    if (parts.includes('organization') && user) {
      values.push(`org:${user.organizationId}`);
    }

    return `${options.class}:${hashIdentifier(values.join('|'))}`;
  }
}
