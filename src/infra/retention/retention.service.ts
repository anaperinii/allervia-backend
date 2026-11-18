import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';

export interface RetentionClassResult {
  name: string;
  model: string;
  eligible: number;
  deleted: number;
}

export interface RetentionRunResult {
  dryRun: boolean;
  classes: RetentionClassResult[];
}

const BATCH_SIZE = 500;
const DAY_MS = 24 * 3600_000;

interface RetentionDelegate {
  count(args: { where: Record<string, unknown> }): Promise<number>;
  findMany(args: {
    where: Record<string, unknown>;
    select: { id: boolean };
    take: number;
  }): Promise<Array<{ id: string }>>;
  deleteMany(args: {
    where: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  get enabled(): boolean {
    return process.env.ALLERVIA_RETENTION_ENABLED === 'true';
  }

  private classes(now: number): Array<{
    name: string;
    model: string;
    where: Record<string, unknown>;
  }> {
    return [
      {
        name: 'tentativas de autenticação',
        model: 'authAttempt',
        where: { occurredAt: { lt: new Date(now - DAY_MS) } },
      },
      {
        name: 'desafios pré-auth expirados',
        model: 'preAuthChallenge',
        where: { expiresAt: { lt: new Date(now - DAY_MS) } },
      },
      {
        name: 'tokens de verificação expirados',
        model: 'verificationToken',
        where: { expiresAt: { lt: new Date(now - 7 * DAY_MS) } },
      },
      {
        name: 'fatores MFA pendentes',
        model: 'mfaCredential',
        where: {
          confirmedAt: null,
          revokedAt: null,
          createdAt: { lt: new Date(now - DAY_MS) },
        },
      },
      {
        name: 'sessões encerradas',
        model: 'authSession',
        where: {
          OR: [
            { revokedAt: { lt: new Date(now - 30 * DAY_MS) } },
            { expiresAt: { lt: new Date(now - 30 * DAY_MS) } },
          ],
        },
      },
      {
        name: 'outbox processado',
        model: 'outboxEvent',
        where: {
          processedAt: { lt: new Date(now - 30 * DAY_MS) },
          attempts: { lt: 5 },
        },
      },
    ];
  }

  async runOnce(options?: { dryRun?: boolean }): Promise<RetentionRunResult> {
    const dryRun = options?.dryRun ?? !this.enabled;
    const now = Date.now();
    const classes: RetentionClassResult[] = [];

    for (const spec of this.classes(now)) {
      const delegate = (
        this.prisma as unknown as Record<string, RetentionDelegate>
      )[spec.model];
      const eligible = await delegate.count({ where: spec.where });
      let deleted = 0;
      if (!dryRun && eligible > 0) {
        for (;;) {
          const batch = await delegate.findMany({
            where: spec.where,
            select: { id: true },
            take: BATCH_SIZE,
          });
          if (batch.length === 0) break;
          const result = await delegate.deleteMany({
            where: {
              AND: [spec.where, { id: { in: batch.map((row) => row.id) } }],
            },
          });
          deleted += result.count;
          if (batch.length < BATCH_SIZE) break;
        }
      }
      classes.push({ name: spec.name, model: spec.model, eligible, deleted });
    }

    const summary = classes
      .filter((item) => item.eligible > 0)
      .map((item) =>
        dryRun
          ? `${item.model}=${item.eligible} elegíveis`
          : `${item.model}=${item.deleted} removidos`,
      )
      .join(', ');
    if (summary) {
      this.logger.log(`retention ${dryRun ? 'dry-run' : 'run'}: ${summary}`);
    }

    return { dryRun, classes };
  }
}
