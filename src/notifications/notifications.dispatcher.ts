import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';

const INTERVAL_MS = 15_000;

@Injectable()
export class NotificationsDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsDispatcher.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly notifications: NotificationsService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      void this.tick();
    }, INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.notifications.processPending();
      if (result.failed > 0)
        this.logger.warn(`Outbox: ${result.failed} evento(s) falharam.`);
    } catch (error) {
      this.logger.error('Outbox tick failed', error);
    } finally {
      this.running = false;
    }
  }
}
