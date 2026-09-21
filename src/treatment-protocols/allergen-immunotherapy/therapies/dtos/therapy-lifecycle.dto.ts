import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const LIFECYCLE_ACTIONS = ['SUSPEND', 'RESUME', 'COMPLETE'] as const;
export type LifecycleAction = (typeof LIFECYCLE_ACTIONS)[number];

/** Recomendações finais estruturadas do encerramento; nada vira texto perdido. */
export class LifecycleRecommendationsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() retesting?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() rescueMedication?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  environmentalControl?: boolean;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  custom?: string[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  monitoringSchedule?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  warningSigns?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class TherapyLifecycleDto {
  @ApiProperty({ enum: LIFECYCLE_ACTIONS })
  @IsIn(LIFECYCLE_ACTIONS)
  action: LifecycleAction;

  @ApiProperty() @IsInt() @Min(0) expectedRevision: number;

  @ApiProperty({ description: 'Clinical reason; never reduced to a status' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

  @ApiPropertyOptional({ description: 'Reason category code (suspension)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({
    description: 'Expected return instant with offset (suspension only)',
  })
  @IsOptional()
  @IsDateString()
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  expectedReturnAt?: string;

  @ApiPropertyOptional({ type: LifecycleRecommendationsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LifecycleRecommendationsDto)
  recommendations?: LifecycleRecommendationsDto;
}
