import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';

export type RateLimitKeyPart = 'ip' | 'user' | 'organization';

export interface RateLimitOptions {
  class: string;
  limit?: number;
  windowSeconds?: number;
  keyBy?: RateLimitKeyPart[];
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
