import { ApiProperty } from '@nestjs/swagger';
import { AdministrationRoute, TherapyStatus } from '@prisma/client';

export class ImmunotherapyResponseDto {
  @ApiProperty({ description: 'ID da imunoterapia' })
  id: string;

  @ApiProperty({ description: 'Tipo de imunoterapia' })
  immunoType: string;

  @ApiProperty({ description: 'Rota de administração' })
  administrationRoute: AdministrationRoute;

  @ApiProperty({ description: 'Extrato' })
  extract: string;

  @ApiProperty({ description: 'Data de início da indução' })
  inductionStartDate: Date;

  @ApiProperty({ description: 'Data de início da manutenção' })
  maintenanceStartDate: Date | null;

  @ApiProperty({ description: 'Concentração alvo' })
  targetConcentration: number;

  @ApiProperty({ description: 'Volume alvo' })
  targetVolume: number;

  @ApiProperty({ description: 'ID do paciente' })
  patientId: string;

  @ApiProperty({ description: 'ID do médico responsável' })
  responsiblePhysicianId: string;

  @ApiProperty({ description: 'Indica se a imunoterapia está arquivada' })
  isArchived: boolean;

  @ApiProperty({ description: 'Status da terapia' })
  status: TherapyStatus;

  @ApiProperty({ description: 'Data de criação' })
  createdAt: Date;

  @ApiProperty({ description: 'Data da última atualização' })
  updatedAt: Date;

  @ApiProperty({ description: 'ID do usuário que criou' })
  createdById: string;

  @ApiProperty({ description: 'ID do usuário que atualizou pela última vez' })
  updatedById: string | null;

  @ApiProperty({ description: 'ID do usuário que arquivou' })
  archivedById: string | null;

  @ApiProperty({ description: 'Data em que foi arquivada' })
  archivedAt: Date | null;
}
