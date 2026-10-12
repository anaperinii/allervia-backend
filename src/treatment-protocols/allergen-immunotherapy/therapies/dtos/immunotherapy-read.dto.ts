import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdministrationRoute, DoseStatus, TherapyStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PageQueryDto } from 'src/infra/http/pagination';

export type ProtocolPhase = 'BUILD_UP' | 'MAINTENANCE';

export class ListImmunotherapiesQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nome do paciente ou extrato' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  search?: string;

  @ApiPropertyOptional({ enum: TherapyStatus })
  @IsOptional()
  @IsEnum(TherapyStatus)
  status?: TherapyStatus;

  @ApiPropertyOptional({ enum: AdministrationRoute })
  @IsOptional()
  @IsEnum(AdministrationRoute)
  route?: AdministrationRoute;

  @ApiPropertyOptional({ description: 'Filtra pelo tipo de alérgeno' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  immunoType?: string;

  @ApiPropertyOptional({ description: 'Filtra por médico responsável' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  responsiblePhysicianId?: string;

  @ApiPropertyOptional({ description: 'Inclui tratamentos arquivados' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeArchived?: boolean;
}

export class TherapyPatientRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  isActive: boolean;
}

export class TherapyPhysicianRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;
}

export class TherapyPrescriptionRefDto {
  @ApiProperty()
  versionId: string;

  @ApiProperty()
  revision: number;
}

export class TherapyNextDoseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: String, format: 'date-time' })
  scheduledAt: Date;

  @ApiProperty({ enum: DoseStatus })
  status: DoseStatus;

  @ApiProperty({
    description:
      'Intervalo até a dose seguinte, em dias, fixado no planejamento',
  })
  intervalDays: number;

  @ApiProperty({ enum: ['BUILD_UP', 'MAINTENANCE'] })
  phase: ProtocolPhase;
}

export class TherapyPrescriptionDetailDto extends TherapyPrescriptionRefDto {
  @ApiPropertyOptional({ type: Object })
  resolved?: unknown;
}

export class ImmunotherapyListItemDto {
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

  @ApiProperty({ type: String, format: 'date-time' })
  inductionStartDate: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  maintenanceStartDate: Date | null;

  @ApiProperty({ type: TherapyPatientRefDto })
  patient: TherapyPatientRefDto;

  @ApiProperty({ type: TherapyPhysicianRefDto })
  responsiblePhysician: TherapyPhysicianRefDto;

  @ApiPropertyOptional({ type: TherapyPrescriptionRefDto, nullable: true })
  prescription: TherapyPrescriptionRefDto | null;

  @ApiPropertyOptional({
    type: TherapyNextDoseDto,
    nullable: true,
    description: 'Previsão em aberto mais próxima; ausência não é término',
  })
  nextDose: TherapyNextDoseDto | null;

  @ApiProperty({
    enum: ['BUILD_UP', 'MAINTENANCE'],
    description:
      'Fase vigente: lida do snapshot da previsão em aberto e, sem ela, do início da manutenção',
  })
  currentPhase: ProtocolPhase;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class ImmunotherapyDetailDto extends ImmunotherapyListItemDto {
  @ApiProperty()
  isArchived: boolean;

  @ApiPropertyOptional({
    type: TherapyPrescriptionDetailDto,
    nullable: true,
    description:
      'Snapshot imutável da prescrição: versão fixada, revisão e seleção resolvida. Histórico é lido daqui, nunca reinterpretado pela versão padrão vigente.',
  })
  declare prescription: TherapyPrescriptionDetailDto | null;

  @ApiProperty({
    description: 'Doses não arquivadas, da mais recente para a mais antiga',
  })
  doseCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}
