import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { AuditModule } from 'src/infra/audit/audit.module';
import { PermissionsModule } from 'src/security/permissions/permissions.module';
import { GoogleCalendarConfig } from './google-calendar.config';
import { GoogleTokenBoxService } from './google-token-box.service';
import { OAuthStateService } from './oauth-state.service';
import { GoogleCalendarClient } from './google-calendar.client';
import { GoogleCalendarFetchClient } from './google-calendar.fetch-client';
import { GoogleAuthService } from './google-auth.service';
import { GoogleEventMapperService } from './google-event-mapper.service';
import { ChannelLifecycleService } from './channel-lifecycle.service';
import { GoogleCalendarConnectionService } from './google-calendar-connection.service';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarInboundSyncService } from './calendar-inbound-sync.service';
import { CalendarSyncDispatcher } from './calendar-sync.dispatcher';
import { GoogleCalendarController } from './google-calendar.controller';
import { GoogleCalendarWebhookController } from './google-calendar-webhook.controller';

@Module({
  imports: [PrismaModule, AuditModule, PermissionsModule],
  providers: [
    GoogleCalendarConfig,
    GoogleTokenBoxService,
    OAuthStateService,
    { provide: GoogleCalendarClient, useClass: GoogleCalendarFetchClient },
    GoogleAuthService,
    GoogleEventMapperService,
    ChannelLifecycleService,
    GoogleCalendarConnectionService,
    CalendarSyncService,
    CalendarInboundSyncService,
    CalendarSyncDispatcher,
  ],
  controllers: [GoogleCalendarController, GoogleCalendarWebhookController],
  exports: [CalendarSyncService, GoogleCalendarConnectionService],
})
export class GoogleCalendarModule {}
