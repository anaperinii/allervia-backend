import { ApiPropertyOptional } from '@nestjs/swagger';
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
