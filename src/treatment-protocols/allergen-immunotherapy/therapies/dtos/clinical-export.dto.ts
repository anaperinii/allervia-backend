import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  AdministrationRoute,
  DoseImmediateConduct,
  DoseStatus,
  TherapyStatus,
} from '@prisma/client';
import { PageQueryDto } from 'src/infra/http/pagination';
import { DoseValuesResponseDto } from '../../dosing/dtos/dose-response.dto';
import { ProfessionalRefDto } from './therapy-lifecycle-response.dto';

export class ClinicalExportQueryDto extends PageQueryDto {
  @ApiPropertyOptional({
    description:
      'Temporal cut (ISO with offset). Omit on page 1 to use server time; reuse the returned asOf on subsequent pages. Only records created up to this instant belong to the export set.',
  })
  @IsOptional()
  @IsDateString()
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  asOf?: string;

  @ApiPropertyOptional({ enum: TherapyStatus })
  @IsOptional()
  @IsEnum(TherapyStatus)
  status?: TherapyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  responsiblePhysicianId?: string;

  @ApiPropertyOptional({
    maxLength: 500,
    description:
      'Justificativa LGPD informada pelo solicitante; registrada na auditoria de exportação',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  justification?: string;
}

export class ExportAdministeredByDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: String, nullable: true })
  fullName: string | null;
}

export class ExportPrescriptionDto {
  @ApiProperty()
  versionId: string;

  @ApiProperty()
  protocolName: string;

  @ApiProperty()
  versionNumber: number;

  @ApiProperty({ type: String, nullable: true })
  timeZone: string | null;
}

export class ExportTherapyDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  immunoType: string;

  @ApiProperty()
  extract: string;

  @ApiProperty({ enum: TherapyStatus })
  status: TherapyStatus;

  @ApiProperty({ enum: AdministrationRoute })
  administrationRoute: AdministrationRoute;

  @ApiProperty({ type: String, format: 'date-time' })
  inductionStartDate: Date;
}

export class ExportPatientDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: ProfessionalRefDto })
  responsiblePhysician: ProfessionalRefDto;
}

export class ClinicalExportRowDto {
  @ApiProperty()
  doseId: string;

  @ApiProperty({ enum: DoseStatus })
  status: DoseStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  scheduledAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  administeredAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  administrationEndedAt: Date | null;

  @ApiProperty({ type: DoseValuesResponseDto, nullable: true })
  planned: unknown;

  @ApiProperty({ type: DoseValuesResponseDto, nullable: true })
  administered: unknown;

  @ApiProperty({ enum: DoseImmediateConduct, nullable: true })
  immediateConduct: DoseImmediateConduct | null;

  @ApiProperty({ type: ExportAdministeredByDto, nullable: true })
  administeredBy: ExportAdministeredByDto | null;

  @ApiProperty({ type: ExportPrescriptionDto, nullable: true })
  prescription: ExportPrescriptionDto | null;

  @ApiProperty({ type: ExportTherapyDto })
  therapy: ExportTherapyDto;

  @ApiProperty({ type: ExportPatientDto })
  patient: ExportPatientDto;
}

export class ClinicalExportPageDto {
  @ApiProperty({ type: [ClinicalExportRowDto] })
  items: ClinicalExportRowDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty({ description: 'Total de registros no corte temporal' })
  total: number;

  @ApiProperty({ type: String, format: 'date-time' })
  asOf: string;
}
