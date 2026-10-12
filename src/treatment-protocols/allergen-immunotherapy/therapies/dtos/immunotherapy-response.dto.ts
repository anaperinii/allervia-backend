import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdministrationRoute, TherapyStatus } from '@prisma/client';
import { PrescriptionSnapshotDto } from './immunotherapy-registration-response.dto';

export class ImmunotherapyResponseDto {
  @ApiPropertyOptional({
    description: 'Concurrency revision for clinical writes',
  })
  revision?: number;
  @ApiPropertyOptional({
    type: PrescriptionSnapshotDto,
    nullable: true,
    description:
      'Immutable prescription snapshot: versionId, revision and resolved step selection',
  })
  prescription?: PrescriptionSnapshotDto | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  currentPrescriptionId?: string | null;

  @ApiProperty({ description: 'ID da imunoterapia' })
  id: string;

  @ApiProperty({ description: 'Tipo de imunoterapia' })
  immunoType: string;

  @ApiProperty({
    enum: AdministrationRoute,
    description: 'Rota de administração',
  })
  administrationRoute: AdministrationRoute;

  @ApiProperty({ description: 'Extrato' })
  extract: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Data de início da indução',
  })
  inductionStartDate: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Data de início da manutenção',
  })
  maintenanceStartDate: Date | null;

  @ApiProperty({ description: 'Concentração alvo' })
  targetConcentration: number;

  @ApiProperty({
    type: String,
    description: 'Volume alvo em decimal exato',
  })
  targetVolume: string;

  @ApiProperty({ description: 'ID do paciente' })
  patientId: string;

  @ApiProperty({ description: 'Indica se a imunoterapia está arquivada' })
  isArchived: boolean;

  @ApiProperty({ enum: TherapyStatus, description: 'Status da terapia' })
  status: TherapyStatus;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Data de criação',
  })
  createdAt: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Data da última atualização',
  })
  updatedAt: Date;

  @ApiProperty({ description: 'ID do usuário que criou' })
  createdById: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'ID do usuário que atualizou pela última vez',
  })
  updatedById: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'ID do usuário que arquivou',
  })
  archivedById: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Data em que foi arquivada',
  })
  archivedAt: Date | null;
}
