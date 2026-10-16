import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { NotificationKind } from '@prisma/client';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { AuthenticatedOnly } from 'src/security/decorators/authenticated-only.decorator';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { PageQueryDto } from 'src/infra/http/pagination';
import {
  MarkAllReadResponseDto,
  NotificationDto,
  NotificationPageDto,
  NotificationPreferenceDto,
  OutboxRetryResponseDto,
  OutboxStatusDto,
} from './dtos/notification-response.dto';
import { NotificationsService } from './notifications.service';

class ListNotificationsDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()

  @Transform(({ value }: { value: unknown }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : value,
  )
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
  @ApiOkResponse({ type: NotificationPageDto })
  list(
    @Query() query: ListNotificationsDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.notifications.list(query, user);
  }

  @Get('preferences')
  @AuthenticatedOnly()
  @ApiOkResponse({ type: [NotificationPreferenceDto] })
  preferences(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.notifications.preferences(user);
  }

  @Patch('preferences')
  @AuthenticatedOnly()
  @ApiOkResponse({ type: [NotificationPreferenceDto] })
  setPreference(
    @Body() dto: SetPreferenceDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.notifications.setPreference(dto.kind, dto.enabled, user);
  }

  @Get('outbox-status')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOkResponse({ type: OutboxStatusDto })
  outboxStatus(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.notifications.outboxStatus(user);
  }

  @Post('outbox/:id/retry')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiCreatedResponse({ type: OutboxRetryResponseDto })
  @ApiConflictResponse({
    description: 'O evento não está em falha terminal.',
  })
  retryOutbox(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.notifications.retryOutboxEvent(id, user);
  }

  @Post('read-all')
  @AuthenticatedOnly()
  @ApiCreatedResponse({ type: MarkAllReadResponseDto })
  markAllRead(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.notifications.markAllRead(user);
  }

  @Patch(':id/read')
  @AuthenticatedOnly()
  @ApiOkResponse({ type: NotificationDto })
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    return this.notifications.markRead(id, user);
  }
}
