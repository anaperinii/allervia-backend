import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { AppointmentStatus } from '@prisma/client';
import { PageQueryDto } from 'src/infra/http/pagination';

const OFFSET = /T.*(?:Z|[+-]\d{2}:\d{2})$/;

export class CreateAppointmentDto {
  @ApiProperty() @IsString() @IsNotEmpty() patientId: string;

  @ApiPropertyOptional({
    description: 'Optional link to the clinical scheduled dose',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  doseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty() @IsDateString() @Matches(OFFSET) startsAt: string;
  @ApiProperty() @IsDateString() @Matches(OFFSET) endsAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateAppointmentDto {
  @ApiProperty() @IsInt() @Min(0) expectedRevision: number;

  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional({
    description: 'Required when cancelling or marking a miss',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  statusReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  @Matches(OFFSET)
  startsAt?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  @Matches(OFFSET)
  endsAt?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ListAppointmentsQueryDto extends PageQueryDto {
  @ApiProperty() @IsDateString() @Matches(OFFSET) from: string;
  @ApiProperty() @IsDateString() @Matches(OFFSET) to: string;

  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  patientId?: string;
}
