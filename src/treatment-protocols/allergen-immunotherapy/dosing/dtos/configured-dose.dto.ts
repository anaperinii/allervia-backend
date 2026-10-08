import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { DoseImmediateConduct, DoseObservationPhase } from '@prisma/client';

export class ConfiguredDoseValuesDto {
  @ApiProperty({
    example: '1000',
    description: 'Exact decimal dilution denominator',
  })
  @IsString()
  @Matches(/^\d+(\.\d+)?$/)
  concentration: string;
  @ApiProperty({ example: '0.2', description: 'Exact decimal mL' })
  @IsString()
  @Matches(/^\d+(\.\d+)?$/)
  volume: string;
  @ApiProperty() @IsInt() @Min(1) intervalDays: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  stepId?: string;
  @ApiPropertyOptional({ enum: ['BUILD_UP', 'MAINTENANCE'] })
  @IsOptional()
  @IsEnum({ BUILD_UP: 'BUILD_UP', MAINTENANCE: 'MAINTENANCE' })
  phase?: 'BUILD_UP' | 'MAINTENANCE';
}
export class DoseRevisionDto {
  @ApiProperty() @IsInt() @Min(0) expectedRevision: number;
  @ApiProperty() @IsInt() @Min(0) expectedTherapyRevision: number;
}
export class DosePreviewDto extends DoseRevisionDto {
  @ApiProperty()
  @ValidateNested()
  @Type(() => ConfiguredDoseValuesDto)
  values: ConfiguredDoseValuesDto;
  @ApiProperty({ description: 'ISO timestamp with explicit offset' })
  @IsDateString()
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  administeredAt: string;
}
export class UpdateScheduledDoseDto extends DoseRevisionDto {
  @ApiProperty()
  @ValidateNested()
  @Type(() => ConfiguredDoseValuesDto)
  values: ConfiguredDoseValuesDto;
  @ApiProperty()
  @IsDateString()
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  scheduledAt: string;
  @ApiProperty({
    description: 'Clinical reason for adjusting the planned session',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}
export class DoseObservationDto {
  @ApiProperty({ enum: DoseObservationPhase })
  @IsEnum(DoseObservationPhase)
  phase: DoseObservationPhase;
  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  reportedSideEffects: string[];
  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  administeredMedications: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class DoseImmediateConductDto {
  @ApiProperty({ enum: DoseImmediateConduct })
  @IsEnum(DoseImmediateConduct)
  type: DoseImmediateConduct;
  @ApiPropertyOptional({
    description: 'Required for any conduct other than MAINTAIN',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  justification?: string;
}
export class AdministerDoseDto extends DosePreviewDto {
  @ApiProperty({
    description: 'Stable key reused for retries of this exact command',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey: string;
  @ApiProperty() @IsString() betweenDosesReport: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
  @ApiPropertyOptional({ type: [DoseObservationDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => DoseObservationDto)
  observations?: DoseObservationDto[];
  @ApiPropertyOptional({
    description:
      'End of the administration window; administeredAt is the start',
  })
  @IsOptional()
  @IsDateString()
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  administrationEndedAt?: string;
  @ApiPropertyOptional({
    description:
      'User ID of the professional who executed the application. Defaults to the authenticated professional; must belong to the organization and hold a clinical role.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  administeredById?: string;
  @ApiPropertyOptional({ type: DoseImmediateConductDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DoseImmediateConductDto)
  immediateConduct?: DoseImmediateConductDto;
}
