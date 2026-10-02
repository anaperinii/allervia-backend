import { Controller, Headers, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PrismaService } from 'src/infra/database/prisma.service';
import { Public } from 'src/security/decorators/public.decorator';
import { SkipCsrf } from 'src/security/session/skip-csrf.decorator';
import { enqueueCalendarSync } from './calendar-sync.enqueue';

@ApiExcludeController()
@Controller('integrations/google-calendar')
export class GoogleCalendarWebhookController {
  private readonly logger = new Logger(GoogleCalendarWebhookController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post('webhook')
  @Public()
  @SkipCsrf()
  @HttpCode(200)
  async webhook(
    @Headers('x-goog-channel-id') channelId: string | undefined,
    @Headers('x-goog-resource-state') resourceState: string | undefined,
    @Headers('x-goog-channel-token') channelToken: string | undefined,
  ): Promise<void> {
    if (!channelId || resourceState === 'sync') return;

    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { channelId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        channelTokenHash: true,
      },
    });
    if (!connection || connection.status !== 'ACTIVE') return;

    if (!this.tokenMatches(channelToken, connection.channelTokenHash)) {
      this.logger.warn(
        `webhook token mismatch for channel ${channelId}; notification ignored`,
      );
      return;
    }

    await enqueueCalendarSync(this.prisma, {
      organizationId: connection.organizationId,
      kind: 'PULL_INCREMENTAL',
      connectionId: connection.id,
    });
  }

  private tokenMatches(
    token: string | undefined,
    storedHash: string | null,
  ): boolean {
    if (!token || !storedHash) return false;
    const received = createHash('sha256').update(token).digest();
    const expected = Buffer.from(storedHash, 'hex');
    return (
      received.length === expected.length && timingSafeEqual(received, expected)
    );
  }
}
