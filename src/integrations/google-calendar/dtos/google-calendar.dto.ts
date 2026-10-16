import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GoogleCalendarConnectionStatus, Profession } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class OAuthCallbackQueryDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() error?: string;
  @IsOptional() @IsString() scope?: string;
  @IsOptional() @IsString() authuser?: string;
  @IsOptional() @IsString() prompt?: string;
  @IsOptional() @IsString() hd?: string;
  @IsOptional() @IsString() iss?: string;
}

export class DisconnectQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  removeEvents?: boolean;
}

export class GoogleAuthorizationUrlDto {
  @ApiProperty({
    description: 'URL de consentimento OAuth do Google para redirecionamento',
  })
  authorizationUrl: string;
}

export class GoogleCalendarStatusDisconnectedDto {
  @ApiProperty({ oneOf: [{ type: 'boolean', enum: [false] }] })
  connected: false;
}

export class GoogleCalendarStatusConnectedDto {
  @ApiProperty({ oneOf: [{ type: 'boolean', enum: [true] }] })
  connected: true;

  @ApiProperty()
  googleAccountEmail: string;

  @ApiProperty({ enum: GoogleCalendarConnectionStatus })
  status: GoogleCalendarConnectionStatus;

  @ApiProperty({ type: String, nullable: true })
  brokenReason: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  channelExpiresAt: Date | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  lastIncrementalSyncAt: Date | null;

  @ApiProperty()
  pendingJobs: number;

  @ApiProperty()
  deadLetteredJobs: number;
}

export class GoogleCalendarConnectionProfessionalDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ enum: Profession })
  profession: Profession;
}

export class GoogleCalendarConnectionListItemDto {
  @ApiProperty()
  professionalId: string;

  @ApiProperty()
  googleAccountEmail: string;

  @ApiProperty({ enum: GoogleCalendarConnectionStatus })
  status: GoogleCalendarConnectionStatus;

  @ApiProperty({ type: String, nullable: true })
  brokenReason: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  channelExpiresAt: Date | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  lastIncrementalSyncAt: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: GoogleCalendarConnectionProfessionalDto })
  professional: GoogleCalendarConnectionProfessionalDto;
}

export class GoogleCalendarDisconnectedResultDto {
  @ApiProperty({ type: Boolean, example: true })
  disconnected: true;
}
