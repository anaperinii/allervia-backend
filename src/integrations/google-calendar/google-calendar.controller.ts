import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Redirect,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import { Public } from 'src/security/decorators/public.decorator';
import { SkipCsrf } from 'src/security/session/skip-csrf.decorator';
import { SessionCookieService } from 'src/security/session/session-cookie.service';
import { SessionService } from 'src/security/session/session.service';
import { GoogleCalendarConnectionService } from './google-calendar-connection.service';
import {
  DisconnectQueryDto,
  GoogleAuthorizationUrlDto,
  GoogleCalendarConnectionListItemDto,
  GoogleCalendarDisconnectedResultDto,
  GoogleCalendarStatusConnectedDto,
  GoogleCalendarStatusDisconnectedDto,
  OAuthCallbackQueryDto,
} from './dtos/google-calendar.dto';

@ApiTags('google-calendar')
@Controller('integrations/google-calendar')
export class GoogleCalendarController {
  constructor(
    private readonly connections: GoogleCalendarConnectionService,
    private readonly sessions: SessionService,
    private readonly cookies: SessionCookieService,
  ) {}

  @Post('connect')
  @CheckPolicies({ action: 'manage', subject: 'GoogleCalendarConnection' })
  @ApiCreatedResponse({ type: GoogleAuthorizationUrlDto })
  connect(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.connections.buildAuthorizationUrl(user);
  }

  @Get('callback')
  @Public()
  @SkipCsrf()
  @Redirect()
  @ApiResponse({
    status: 302,
    description:
      'Redireciona para a tela de configurações do frontend com status=connected ou status=error&code=<CODIGO>.',
    headers: {
      Location: {
        description: 'URL de configurações do frontend com o resultado',
        schema: { type: 'string' },
      },
    },
  })
  async callback(
    @Query() query: OAuthCallbackQueryDto,
    @Req() request: Request,
  ) {
    const url = await this.connections.handleCallback(
      query.code ?? '',
      query.state ?? '',
      await this.sessionUserId(request),
    );
    return { url, statusCode: 302 };
  }

  private async sessionUserId(request: Request): Promise<string | null> {
    try {
      const secret = this.cookies.read(request);
      if (!secret) return null;
      const { context } = await this.sessions.validate(secret);
      return context.userId;
    } catch {
      return null;
    }
  }

  @Get('connection')
  @CheckPolicies({ action: 'read', subject: 'GoogleCalendarConnection' })
  @ApiExtraModels(
    GoogleCalendarStatusConnectedDto,
    GoogleCalendarStatusDisconnectedDto,
  )
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(GoogleCalendarStatusConnectedDto) },
        { $ref: getSchemaPath(GoogleCalendarStatusDisconnectedDto) },
      ],
    },
  })
  status(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.connections.status(user);
  }

  @Delete('connection')
  @CheckPolicies({ action: 'manage', subject: 'GoogleCalendarConnection' })
  @ApiOkResponse({ type: GoogleCalendarDisconnectedResultDto })
  disconnect(
    @Query() query: DisconnectQueryDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.connections.disconnect(user, query.removeEvents ?? false);
  }

  @Get('connections')
  @CheckPolicies({ action: 'read', subject: 'GoogleCalendarConnection' })
  @ApiOkResponse({ type: [GoogleCalendarConnectionListItemDto] })
  list(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.connections.listConnections(user);
  }

  @Delete('connections/:professionalId')
  @CheckPolicies({ action: 'manage', subject: 'GoogleCalendarConnection' })
  @ApiOkResponse({ type: GoogleCalendarDisconnectedResultDto })
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
