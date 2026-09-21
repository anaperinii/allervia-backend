import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { TherapyStatus } from '@prisma/client';
import { PageQueryDto } from 'src/infra/http/pagination';

export class ClinicalExportQueryDto extends PageQueryDto {
  @ApiProperty({
    description:
      'Temporal cut (ISO with offset): only records created up to this instant belong to the export set',
  })
  @IsDateString()
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  asOf: string;

  @ApiPropertyOptional({ enum: TherapyStatus })
  @IsOptional()
  @IsEnum(TherapyStatus)
  status?: TherapyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  responsiblePhysicianId?: string;
}
