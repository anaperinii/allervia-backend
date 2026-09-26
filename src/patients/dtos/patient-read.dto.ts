import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdministrationRoute, DoseStatus, TherapyStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from 'src/infra/http/pagination';

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

  @ApiProperty({ nullable: true })
  councilNumber: string | null;

  @ApiProperty({ nullable: true })
  councilUf: string | null;
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

  @ApiProperty({ nullable: true })
  maintenanceStartDate: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Versão de protocolo fixada na prescrição',
  })
  prescription: {
    versionId: string;
    revision: number;
  } | null;

  @ApiPropertyOptional({ nullable: true })
  nextDose: {
    id: string;
    scheduledAt: Date;
    status: DoseStatus;
  } | null;

  @ApiProperty()
  createdAt: Date;
}

export class PatientListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ nullable: true, description: 'Documento mascarado' })
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

export class PatientDetailDto extends PatientListItemDto {
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Documento completo; presente apenas quando o ator pode editar o cadastro',
  })
  cpf?: string | null;

  @ApiProperty({ type: [TherapySummaryDto] })
  therapies: TherapySummaryDto[];

  @ApiProperty()
  updatedAt: Date;
}
