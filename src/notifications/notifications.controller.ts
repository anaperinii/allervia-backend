import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { NotificationKind } from '@prisma/client';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { AuthenticatedOnly } from 'src/security/decorators/authenticated-only.decorator';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { PageQueryDto } from 'src/infra/http/pagination';
import { NotificationsService } from './notifications.service';

class ListNotificationsDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;
}

class SetPreferenceDto {
  @ApiProperty({ enum: NotificationKind })
  @IsEnum(NotificationKind)
  kind: NotificationKind;

  @ApiProperty() @IsBoolean() enabled: boolean;
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @AuthenticatedOnly()
  list(
    @Query() query: ListNotificationsDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.notifications.list(query, user);
  }

  @Get('preferences')
  @AuthenticatedOnly()
  preferences(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.notifications.preferences(user);
  }

  @Patch('preferences')
  @AuthenticatedOnly()
  setPreference(
    @Body() dto: SetPreferenceDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.notifications.setPreference(dto.kind, dto.enabled, user);
  }

  @Get('outbox-status')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  outboxStatus(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.notifications.outboxStatus(user);
  }

  @Post('read-all')
  @AuthenticatedOnly()
  markAllRead(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.notifications.markAllRead(user);
  }

  @Patch(':id/read')
  @AuthenticatedOnly()
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.notifications.markRead(id, user);
  }
}
