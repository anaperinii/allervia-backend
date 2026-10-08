import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { DoseStatus } from '@prisma/client';
import { PageQueryDto } from 'src/infra/http/pagination';

const OFFSET_PATTERN = /T.*(?:Z|[+-]\d{2}:\d{2})$/;

export class SchedulePeriodDto {
  @ApiProperty({ description: 'ISO instant with explicit offset (inclusive)' })
  @IsDateString()
  @Matches(OFFSET_PATTERN)
  from: string;

  @ApiProperty({ description: 'ISO instant with explicit offset (inclusive)' })
  @IsDateString()
  @Matches(OFFSET_PATTERN)
  to: string;
}

export class ScheduleQueryDto extends PageQueryDto {
  @ApiProperty({ description: 'ISO instant with explicit offset (inclusive)' })
  @IsDateString()
  @Matches(OFFSET_PATTERN)
  from: string;

  @ApiProperty({ description: 'ISO instant with explicit offset (inclusive)' })
  @IsDateString()
  @Matches(OFFSET_PATTERN)
  to: string;

  @ApiPropertyOptional({ enum: DoseStatus })
  @IsOptional()
  @IsEnum(DoseStatus)
  status?: DoseStatus;

  @ApiPropertyOptional({ description: 'Patient name filter' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  responsiblePhysicianId?: string;
}
