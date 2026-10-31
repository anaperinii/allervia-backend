import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const RATE_LIMIT_CLASSES = {
  publicSubmit: 'public-submit',
  export: 'export',
  webhook: 'webhook',
} as const;

export type RateLimitClass =
  (typeof RATE_LIMIT_CLASSES)[keyof typeof RATE_LIMIT_CLASSES];

export interface RateLimitClassPolicy {
  limit: number;
  windowSeconds: number;
  failOpen: boolean;
}

@Injectable()
export class RateLimitConfig {
  constructor(private readonly configService: ConfigService) {}

  forClass(rateClass: string): RateLimitClassPolicy | null {
    switch (rateClass) {
      case RATE_LIMIT_CLASSES.publicSubmit:
        return {
          limit: this.positiveNumber('RATE_LIMIT_PUBLIC_SUBMIT_MAX', 5),
          windowSeconds: this.positiveNumber(
            'RATE_LIMIT_PUBLIC_SUBMIT_WINDOW_SECONDS',
            60,
          ),
          failOpen: false,
        };
      case RATE_LIMIT_CLASSES.webhook:
        return {
          limit: this.positiveNumber('RATE_LIMIT_WEBHOOK_MAX', 120),
          windowSeconds: this.positiveNumber(
            'RATE_LIMIT_WEBHOOK_WINDOW_SECONDS',
            60,
          ),
          failOpen: true,
        };
      case RATE_LIMIT_CLASSES.export:
        return {
          limit: this.positiveNumber('RATE_LIMIT_EXPORT_MAX', 10),
          windowSeconds: this.positiveNumber(
            'RATE_LIMIT_EXPORT_WINDOW_SECONDS',
            3600,
          ),
          failOpen: true,
        };
      default:
        return null;
    }
  }

  private positiveNumber(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    if (raw === undefined || raw === null || raw === '') return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
