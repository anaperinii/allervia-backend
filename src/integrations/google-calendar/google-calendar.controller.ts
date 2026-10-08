import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Redirect,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import { Public } from 'src/security/decorators/public.decorator';
import { SkipCsrf } from 'src/security/session/skip-csrf.decorator';
import { GoogleCalendarConnectionService } from './google-calendar-connection.service';
import {
  DisconnectQueryDto,
  OAuthCallbackQueryDto,
} from './dtos/google-calendar.dto';

@ApiTags('google-calendar')
@Controller('integrations/google-calendar')
export class GoogleCalendarController {
  constructor(private readonly connections: GoogleCalendarConnectionService) {}

  @Post('connect')
  @CheckPolicies({ action: 'manage', subject: 'GoogleCalendarConnection' })
  connect(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.connections.buildAuthorizationUrl(user);
  }

  @Get('callback')
  @Public()
  @SkipCsrf()
  @Redirect()
  async callback(@Query() query: OAuthCallbackQueryDto) {
    const url = await this.connections.handleCallback(
      query.code ?? '',
      query.state ?? '',
    );
    return { url, statusCode: 302 };
  }

  @Get('connection')
  @CheckPolicies({ action: 'read', subject: 'GoogleCalendarConnection' })
  status(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.connections.status(user);
  }

  @Delete('connection')
  @CheckPolicies({ action: 'manage', subject: 'GoogleCalendarConnection' })
  disconnect(
    @Query() query: DisconnectQueryDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.connections.disconnect(user, query.removeEvents ?? false);
  }

  @Get('connections')
  @CheckPolicies({ action: 'read', subject: 'GoogleCalendarConnection' })
  list(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.connections.listConnections(user);
  }

  @Delete('connections/:professionalId')
  @CheckPolicies({ action: 'manage', subject: 'GoogleCalendarConnection' })
  disconnectProfessional(
    @Param('professionalId') professionalId: string,
    @Query() query: DisconnectQueryDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.connections.disconnectProfessional(
      professionalId,
      user,
      query.removeEvents ?? false,
    );
  }
}
