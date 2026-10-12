import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { CodedHttpException } from 'src/infra/exceptions/coded.exception';
import { messageForCode } from 'src/infra/errors/error-catalog';

export interface RateLimitConsumeOptions {
  class: string;
  key: string;
  limit: number;
  windowSeconds: number;
  failOpen?: boolean;
}

export interface RateLimitConsumeResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

interface CounterRow {
  count: number;
  expiresAt: Date;
}

const CLEANUP_INTERVAL_MS = 60_000;

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private lastCleanupAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  async consume(
    options: RateLimitConsumeOptions,
  ): Promise<RateLimitConsumeResult> {
    const now = new Date();
    const windowExpiresAt = new Date(
      now.getTime() + options.windowSeconds * 1000,
    );
    let rows: CounterRow[];
    try {
      rows = await this.prisma.$queryRaw<CounterRow[]>`
        INSERT INTO "RateLimitCounter" ("key", "windowStartsAt", "count", "expiresAt")
        VALUES (${options.key}, ${now}, 1, ${windowExpiresAt})
        ON CONFLICT ("key") DO UPDATE SET
          "windowStartsAt" = CASE
            WHEN "RateLimitCounter"."expiresAt" <= ${now} THEN ${now}
            ELSE "RateLimitCounter"."windowStartsAt"
          END,
          "count" = CASE
            WHEN "RateLimitCounter"."expiresAt" <= ${now} THEN 1
            WHEN "RateLimitCounter"."count" <= ${options.limit} THEN "RateLimitCounter"."count" + 1
            ELSE "RateLimitCounter"."count"
          END,
          "expiresAt" = CASE
            WHEN "RateLimitCounter"."expiresAt" <= ${now} THEN ${windowExpiresAt}
            ELSE "RateLimitCounter"."expiresAt"
          END
        RETURNING "count", "expiresAt"
      `;
    } catch (error) {
      return this.handleStorageFailure(options, error);
    }

    this.cleanupExpiredKeys();

    const row = rows[0];
    if (!row) {
      return this.handleStorageFailure(
        options,
        new Error('rate limit upsert returned no row'),
      );
    }

    if (Number(row.count) <= options.limit) {
      return { allowed: true };
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((new Date(row.expiresAt).getTime() - Date.now()) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }

  private handleStorageFailure(
    options: RateLimitConsumeOptions,
    error: unknown,
  ): RateLimitConsumeResult {
    const detail = error instanceof Error ? error.stack : String(error);
    if (options.failOpen) {
      this.logger.warn(
        `Rate limit storage unavailable; allowing request (class=${options.class})`,
        detail,
      );
      return { allowed: true };
    }
    this.logger.error(
      `Rate limit storage unavailable; denying request (class=${options.class})`,
      detail,
    );
    throw new CodedHttpException(
      HttpStatus.SERVICE_UNAVAILABLE,
      'SERVICE_UNAVAILABLE',
      messageForCode('SERVICE_UNAVAILABLE')!,
    );
  }

  private cleanupExpiredKeys(): void {
    const now = Date.now();
    if (now - this.lastCleanupAt < CLEANUP_INTERVAL_MS) return;
    this.lastCleanupAt = now;
    void this.prisma.rateLimitCounter
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch((error: unknown) => {
        this.logger.warn(
          'Rate limit cleanup failed',
          error instanceof Error ? error.stack : String(error),
        );
      });
  }
}
