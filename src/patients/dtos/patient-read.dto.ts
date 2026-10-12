import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdministrationRoute, DoseStatus, TherapyStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from 'src/infra/http/pagination';
import { TherapyPrescriptionRefDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/immunotherapy-read.dto';

export class ListPatientsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nome ou telefone' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  search?: string;

  @ApiPropertyOptional({ description: 'Filtra por situação do cadastro' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filtra por médico responsável' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  responsiblePhysicianId?: string;
}

export class ResponsiblePhysicianDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ type: String, nullable: true })
  councilNumber: string | null;

  @ApiProperty({ type: String, nullable: true })
  councilUf: string | null;
}

export class TherapySummaryNextDoseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: String, format: 'date-time' })
  scheduledAt: Date;

  @ApiProperty({ enum: DoseStatus })
  status: DoseStatus;
}

export class TherapySummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  immunoType: string;

  @ApiProperty({ enum: AdministrationRoute })
  administrationRoute: AdministrationRoute;

  @ApiProperty()
  extract: string;

  @ApiProperty({ enum: TherapyStatus })
  status: TherapyStatus;

  @ApiProperty({ description: 'Revisão de concorrência do tratamento' })
  revision: number;

  @ApiProperty()
  inductionStartDate: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  maintenanceStartDate: Date | null;

  @ApiPropertyOptional({
    type: TherapyPrescriptionRefDto,
    nullable: true,
    description: 'Versão de protocolo fixada na prescrição',
  })
  prescription: {
    versionId: string;
    revision: number;
  } | null;

  @ApiPropertyOptional({ type: TherapySummaryNextDoseDto, nullable: true })
  nextDose: {
    id: string;
    scheduledAt: Date;
    status: DoseStatus;
  } | null;

  @ApiProperty()
  createdAt: Date;
}

export class PatientGuardianDto {
  @ApiProperty()
  fullName: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Documento completo; presente apenas quando o ator pode editar o cadastro',
  })
  cpf: string | null;

  @ApiProperty()
  phoneNumber: string;
}

export class PatientListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Documento mascarado',
  })
  cpfMasked: string | null;

  @ApiProperty()
  birthDate: Date;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty()
  weightInKg: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: ResponsiblePhysicianDto })
  responsiblePhysician: ResponsiblePhysicianDto;

  @ApiProperty({ description: 'Tratamentos não arquivados' })
  therapyCount: number;

  @ApiProperty({ enum: TherapyStatus, isArray: true })
  therapyStatuses: TherapyStatus[];

  @ApiProperty()
  createdAt: Date;
}

export class PatientListPageDto {
  @ApiProperty({ type: [PatientListItemDto] })
  items: PatientListItemDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty({ description: 'Total de registros no escopo da consulta' })
  total: number;
}

export class PatientDetailDto extends PatientListItemDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Documento completo; presente apenas quando o ator pode editar o cadastro',
  })
  cpf?: string | null;

  @ApiProperty({
    type: PatientGuardianDto,
    nullable: true,
    description: 'Responsável legal; null quando o paciente é maior de idade',
  })
  guardian: PatientGuardianDto | null;

  @ApiProperty({ type: [TherapySummaryDto] })
  therapies: TherapySummaryDto[];

  @ApiProperty()
  updatedAt: Date;
}
