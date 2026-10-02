import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CalendarSyncService } from './calendar-sync.service';
import { ChannelLifecycleService } from './channel-lifecycle.service';
import { GoogleCalendarConfig } from './google-calendar.config';

const INTERVAL_MS = 15_000;
const CHANNEL_RENEW_EVERY_TICKS = 20;

@Injectable()
export class CalendarSyncDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CalendarSyncDispatcher.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private ticks = 0;

  constructor(
    private readonly sync: CalendarSyncService,
    private readonly channels: ChannelLifecycleService,
    private readonly config: GoogleCalendarConfig,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    if (!this.config.enabled) {
      this.logger.log(
        'Google Calendar integration disabled: missing configuration.',
      );
      return;
    }
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
      const result = await this.sync.processPending();
      if (result.failed > 0) {
        this.logger.warn(
          `Calendar sync: ${result.failed} job(s) falharam neste ciclo.`,
        );
      }
      this.ticks += 1;
      if (this.ticks % CHANNEL_RENEW_EVERY_TICKS === 0) {
        await this.channels.renewExpiring();
      }
    } catch (error) {
      this.logger.error('Calendar sync tick failed', error);
    } finally {
      this.running = false;
    }
  }
}
