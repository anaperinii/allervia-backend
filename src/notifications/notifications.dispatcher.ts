import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RetentionService } from 'src/infra/retention/retention.service';
import { NotificationsService } from './notifications.service';

const INTERVAL_MS = 15_000;

const RETENTION_EVERY_TICKS = 240;

@Injectable()
export class NotificationsDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsDispatcher.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private inFlight?: Promise<void>;
  private stopping = false;
  private ticks = 0;

  constructor(
    private readonly notifications: NotificationsService,
    private readonly retention: RetentionService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    if (process.env.ALLERVIA_DISPATCHERS_DISABLED === 'true') {
      this.logger.log('Dispatcher disabled by ALLERVIA_DISPATCHERS_DISABLED.');
      return;
    }
    this.timer = setInterval(() => {
      if (!this.stopping && !this.inFlight) {
        this.inFlight = this.tick().finally(() => {
          this.inFlight = undefined;
        });
      }
    }, INTERVAL_MS);
    this.timer.unref();
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.notifications.processPending();
      if (result.failed > 0)
        this.logger.warn(`Outbox: ${result.failed} evento(s) falharam.`);
      this.ticks += 1;
      if (this.ticks % RETENTION_EVERY_TICKS === 0) {

        await this.retention.runOnce();
      }
    } catch (error) {
      this.logger.error('Outbox tick failed', error);
    } finally {
      this.running = false;
    }
  }
}
