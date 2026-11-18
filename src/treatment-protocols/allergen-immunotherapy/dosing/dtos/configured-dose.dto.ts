import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
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

export const NEXT_SCHEDULE_REVIEWS = [
  'KEEP_STEP',
  'STEP_BACK_REQUESTED',
] as const;

export type NextScheduleReview = (typeof NEXT_SCHEDULE_REVIEWS)[number];

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
  @ApiPropertyOptional({
    description:
      'Clinical reason for adjusting the planned session. Required when the resulting interval falls outside the step tolerance, or when there is no preceding administration to measure it against.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason?: string;
  @ApiPropertyOptional({
    enum: NEXT_SCHEDULE_REVIEWS,
    description:
      'Explicit decision about stepping back, required when the resulting interval exceeds the step tolerance.',
  })
  @IsOptional()
  @IsIn(NEXT_SCHEDULE_REVIEWS)
  scheduleReview?: NextScheduleReview;
  @ApiPropertyOptional({
    description:
      'Stable key reused for retries of this exact command. When present, repeating the same key and body returns the original result without editing again; the same key with a different body is rejected with 409 IDEMPOTENCY_KEY_REUSED.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey?: string;
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
  @ApiPropertyOptional({
    description:
      'When the successor should be scheduled, as an ISO timestamp with explicit offset. Omit to use the date the protocol recommends (administeredAt plus the step interval, in the prescription time zone). Only accepted when the engine recommends a successor.',
  })
  @IsOptional()
  @IsDateString()
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  nextScheduledAt?: string;
  @ApiPropertyOptional({
    description:
      'Clinical reason for the resulting interval. Required when the interval falls below the step tolerance (TOO_SHORT) or beyond it (REQUIRES_STEP_REVIEW).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  nextScheduleReason?: string;
  @ApiPropertyOptional({
    enum: NEXT_SCHEDULE_REVIEWS,
    description:
      'Explicit decision about stepping back, required when the interval exceeds the step tolerance (REQUIRES_STEP_REVIEW).',
  })
  @IsOptional()
  @IsIn(NEXT_SCHEDULE_REVIEWS)
  nextScheduleReview?: NextScheduleReview;
}
