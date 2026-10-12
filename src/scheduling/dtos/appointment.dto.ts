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
import { AppointmentStatus, DoseStatus, Profession } from '@prisma/client';
import { PageQueryDto } from 'src/infra/http/pagination';

const OFFSET = /T.*(?:Z|[+-]\d{2}:\d{2})$/;

export class CreateAppointmentDto {
  @ApiProperty() @IsString() @IsNotEmpty() patientId: string;

  @ApiProperty({ description: 'Professional who owns the appointment agenda' })
  @IsString()
  @IsNotEmpty()
  professionalId: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  professionalId?: string;

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

export class AppointmentPatientDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  phoneNumber: string;
}

export class AppointmentDoseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ format: 'date-time' })
  scheduledAt: Date;

  @ApiProperty({ enum: DoseStatus })
  status: DoseStatus;
}

export class AppointmentProfessionalDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ enum: Profession })
  profession: Profession;
}

export class AppointmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  patientId: string;

  @ApiProperty({ type: String, nullable: true })
  doseId: string | null;

  @ApiProperty({ type: String, nullable: true })
  title: string | null;

  @ApiProperty({ format: 'date-time' })
  startsAt: Date;

  @ApiProperty({ format: 'date-time' })
  endsAt: Date;

  @ApiProperty({ enum: AppointmentStatus })
  status: AppointmentStatus;

  @ApiProperty({ type: String, nullable: true })
  notes: string | null;

  @ApiProperty({ type: String, nullable: true })
  statusReason: string | null;

  @ApiProperty({ description: 'Revisão de concorrência do compromisso' })
  revision: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ type: String, nullable: true })
  professionalId: string | null;

  @ApiProperty({ type: AppointmentPatientDto })
  patient: AppointmentPatientDto;

  @ApiProperty({ type: AppointmentDoseDto, nullable: true })
  dose: AppointmentDoseDto | null;

  @ApiProperty({ type: AppointmentProfessionalDto, nullable: true })
  professional: AppointmentProfessionalDto | null;
}

export class AppointmentPageDto {
  @ApiProperty({ type: [AppointmentResponseDto] })
  items: AppointmentResponseDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty({ description: 'Total de registros no escopo da consulta' })
  total: number;
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  professionalId?: string;
}
