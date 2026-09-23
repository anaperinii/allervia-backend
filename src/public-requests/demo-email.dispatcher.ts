import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IEmailService } from 'src/infra/email/email.service';

const MAX_ATTEMPTS = 8;

@Injectable()
export class DemoEmailDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DemoEmailDispatcher.name);
  private timer?: NodeJS.Timeout;
  private inFlight?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: IEmailService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const environment = this.config.get<string>('NODE_ENV');
    const transport =
      this.config.get<string>('EMAIL_TRANSPORT') ??
      (environment === 'production' ? 'smtp' : 'log');
    if (environment === 'test' || transport !== 'smtp') return;
    this.timer = setInterval(() => {
      if (this.inFlight) return;
      this.inFlight = this.processPending()
        .catch(() =>
          this.logger.error(
            'Demo email dispatcher failed; pending jobs remain in the database.',
          ),
        )
        .finally(() => {
          this.inFlight = undefined;
        });
    }, 15_000);
    this.timer.unref();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }

  async processPending(): Promise<void> {
    const to = this.config.get<string>('DEMO_REQUEST_EMAIL_TO');
    if (!to) return;
    const now = new Date();
    const due = {
      emailAcceptedAt: null,
      emailNextAttemptAt: { lte: now },
      OR: [{ emailLeaseUntil: null }, { emailLeaseUntil: { lte: now } }],
    };
    const jobs = await this.prisma.demoRequest.findMany({
      where: due,
      orderBy: { createdAt: 'asc' },
      take: 5,
    });
    for (const job of jobs) {
      const lease = new Date(Date.now() + 180_000);
      const claim = await this.prisma.demoRequest.updateMany({
        where: { ...due, id: job.id, emailAttempts: job.emailAttempts },
        data: { emailLeaseUntil: lease, emailAttempts: { increment: 1 } },
      });
      if (!claim.count) continue;
      const owned = {
        id: job.id,
        emailLeaseUntil: lease,
        emailAttempts: job.emailAttempts + 1,
      };
      // A crash during the final attempt still transitions to a visible terminal failure.
      if (job.emailAttempts >= MAX_ATTEMPTS) {
        await this.prisma.demoRequest.updateMany({
          where: owned,
          data: {
            emailLeaseUntil: null,
            emailNextAttemptAt: null,
            emailErrorCode: 'RETRY_EXHAUSTED',
          },
        });
        this.logger.error(`Demo notification exhausted retries: ${job.id}`);
        continue;
      }
      try {
        await this.mail.sendDemoRequest({ ...job, to });
      } catch {
        const exhausted = job.emailAttempts + 1 >= MAX_ATTEMPTS;
        await this.prisma.demoRequest.updateMany({
          where: owned,
          data: {
            emailLeaseUntil: null,
            emailNextAttemptAt: exhausted
              ? null
              : new Date(
                  Date.now() +
                    Math.min(3_600_000, 60_000 * 2 ** job.emailAttempts),
                ),
            emailErrorCode: exhausted ? 'RETRY_EXHAUSTED' : 'SMTP_SEND_FAILED',
          },
        });
        // No SMTP response, contact fields or credentials in logs.
        this.logger.warn(
          `Demo notification ${exhausted ? 'exhausted retries' : 'will retry'}: ${job.id}`,
        );
        continue;
      }
      // SMTP acceptance is not proof of inbox delivery. Delivery is at least once:
      // a crash between acceptance and this update can cause a duplicate notification.
      await this.prisma.demoRequest.updateMany({
        where: owned,
        data: {
          emailAcceptedAt: new Date(),
          emailLeaseUntil: null,
          emailNextAttemptAt: null,
          emailErrorCode: null,
        },
      });
    }
  }
}
