import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DoseImmediateConductDto } from './configured-dose.dto';

export class RetractDoseDto {
  @ApiProperty({ description: 'Clinical reason for the retraction' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

  @ApiProperty() @IsInt() @Min(0) expectedRevision: number;
  @ApiProperty() @IsInt() @Min(0) expectedTherapyRevision: number;
}

export class LateObservationDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  reportedSideEffects: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  administeredMedications: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @ApiProperty({ description: 'When it was observed; ISO with offset' })
  @IsDateString()
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  observedAt: string;

  @ApiPropertyOptional({ type: DoseImmediateConductDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DoseImmediateConductDto)
  conduct?: DoseImmediateConductDto;

  @ApiProperty() @IsInt() @Min(0) expectedTherapyRevision: number;
}
