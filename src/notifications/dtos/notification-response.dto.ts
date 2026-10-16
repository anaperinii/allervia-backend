import { ApiProperty } from '@nestjs/swagger';
import { NotificationKind } from '@prisma/client';

export class NotificationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  outboxEventId: string;

  @ApiProperty({ enum: NotificationKind })
  kind: NotificationKind;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ type: String, nullable: true })
  entityType: string | null;

  @ApiProperty({ type: String, nullable: true })
  entityId: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  readAt: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

export class NotificationPageDto {
  @ApiProperty({ type: [NotificationDto] })
  items: NotificationDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty({ description: 'Total de registros no escopo da consulta' })
  total: number;

  @ApiProperty({ description: 'Total de notificações não lidas do usuário' })
  unread: number;
}

export class NotificationPreferenceDto {
  @ApiProperty({ enum: NotificationKind })
  kind: NotificationKind;

  @ApiProperty()
  enabled: boolean;
}

export class MarkAllReadResponseDto {
  @ApiProperty({
    description: 'Quantidade de notificações marcadas como lidas',
  })
  marked: number;
}

export class OutboxFailureDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: NotificationKind })
  kind: NotificationKind;

  @ApiProperty()
  attempts: number;

  @ApiProperty({ type: String, nullable: true })
  lastError: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  processedAt: Date | null;
}

export class OutboxRetryResponseDto {
  @ApiProperty() requeued: boolean;

  @ApiProperty() id: string;
}

export class OutboxStatusDto {
  @ApiProperty()
  pending: number;

  @ApiProperty()
  deadLettered: number;

  @ApiProperty({ type: [OutboxFailureDto] })
  lastFailures: OutboxFailureDto[];
}
