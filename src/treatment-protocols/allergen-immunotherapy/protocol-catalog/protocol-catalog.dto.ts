import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsObject,
  IsInt,
  Min,
  IsBoolean,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateProtocolDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(160) name: string;
  @ApiProperty({
    description:
      'SCIT definition with explicit steps; server assigns protocol/version identity',
  })
  @IsObject()
  definition: Record<string, unknown>;
}
export class CreateProtocolVersionDto {
  @ApiProperty() @IsObject() definition: Record<string, unknown>;
}
export class EditProtocolVersionDto extends CreateProtocolVersionDto {
  @ApiProperty() @IsInt() @Min(0) expectedRevision: number;
}
export class ProtocolRevisionDto {
  @ApiProperty() @IsInt() @Min(0) expectedRevision: number;
}
export class SimulateProtocolDto {
  @ApiProperty() @IsObject() prescription: Record<string, unknown>;
  @ApiProperty() @IsObject() administered: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsString() stepId?: string;
}
export class AutomationSettingsDto {
  @ApiProperty() @IsBoolean() enabled: boolean;
  @ApiProperty() @IsString() @IsNotEmpty() timeZone: string;
}

export class BindLegacyProtocolDto {
  @ApiProperty() @IsString() @IsNotEmpty() versionId: string;
  @ApiProperty() @IsObject() prescription: Record<string, unknown>;
  @ApiProperty() @IsInt() @Min(0) expectedRevision: number;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
