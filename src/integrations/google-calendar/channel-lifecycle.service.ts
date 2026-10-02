import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { GoogleCalendarConnection } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { GoogleCalendarClient } from './google-calendar.client';
import { GoogleCalendarConfig } from './google-calendar.config';
import { GoogleAuthService } from './google-auth.service';

const RENEW_WINDOW_MS = 24 * 3_600_000;
const CHANNEL_TTL_SECONDS = '604800';

@Injectable()
export class ChannelLifecycleService {
  private readonly logger = new Logger(ChannelLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GoogleCalendarClient,
    private readonly config: GoogleCalendarConfig,
    private readonly auth: GoogleAuthService,
  ) {}

  async ensureChannel(connection: GoogleCalendarConnection): Promise<void> {
    const webhookUrl = this.config.webhookUrl;
    if (!webhookUrl) return;

    const accessToken = await this.auth.getAccessToken(connection);
    const channelToken = randomBytes(32).toString('hex');
    const watch = await this.client.watchEvents(
      accessToken,
      connection.calendarId,
      {
        id: randomUUID(),
        type: 'web_hook',
        address: webhookUrl,
        token: channelToken,
        params: { ttl: CHANNEL_TTL_SECONDS },
      },
    );

    const previous = {
      channelId: connection.channelId,
      channelResourceId: connection.channelResourceId,
    };

    await this.prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: {
        channelId: watch.id,
        channelResourceId: watch.resourceId,
        channelExpiresAt: watch.expiration
          ? new Date(Number(watch.expiration))
          : null,
        channelTokenHash: createHash('sha256')
          .update(channelToken)
          .digest('hex'),
      },
    });

    if (previous.channelId && previous.channelResourceId) {
      await this.stopChannelQuietly(
        accessToken,
        previous.channelId,
        previous.channelResourceId,
      );
    }
  }

  async stopConnectionChannel(
    connection: GoogleCalendarConnection,
  ): Promise<void> {
    if (!connection.channelId || !connection.channelResourceId) return;
    try {
      const accessToken = await this.auth.getAccessToken(connection);
      await this.stopChannelQuietly(
        accessToken,
        connection.channelId,
        connection.channelResourceId,
      );
    } catch {
      this.logger.warn(
        `channel stop skipped for connection ${connection.id}: token unavailable`,
      );
    }
    await this.prisma.googleCalendarConnection.updateMany({
      where: { id: connection.id },
      data: {
        channelId: null,
        channelResourceId: null,
        channelExpiresAt: null,
        channelTokenHash: null,
      },
    });
  }

  async renewExpiring(): Promise<void> {
    const expiring = await this.prisma.googleCalendarConnection.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { channelExpiresAt: { lt: new Date(Date.now() + RENEW_WINDOW_MS) } },
          { channelId: null },
        ],
      },
      take: 10,
    });
    for (const connection of expiring) {
      try {
        await this.ensureChannel(connection);
      } catch (error) {
        this.logger.warn(
          `channel renewal failed for connection ${connection.id}: ${String(error)}`,
        );
      }
    }
  }

  private async stopChannelQuietly(
    accessToken: string,
    channelId: string,
    resourceId: string,
  ): Promise<void> {
    try {
      await this.client.stopChannel(accessToken, channelId, resourceId);
    } catch {
      this.logger.warn(`channels.stop failed for channel ${channelId}`);
    }
  }
}
