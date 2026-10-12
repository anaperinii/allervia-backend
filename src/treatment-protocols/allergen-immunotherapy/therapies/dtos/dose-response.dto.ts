import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DoseImmediateConduct, DoseStatus } from '@prisma/client';

export class DoseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  immunotherapyId: string;

  @ApiProperty({ description: 'Revisão de concorrência da dose' })
  revision: number;

  @ApiProperty({ enum: DoseStatus })
  status: DoseStatus;

  @ApiProperty({ description: 'Denominador da diluição' })
  concentration: number;

  @ApiProperty({ type: String, description: 'Volume em decimal exato' })
  volume: string;

  @ApiProperty({ type: String, format: 'date-time' })
  scheduledAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  administeredAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  administrationEndedAt?: Date | null;

  @ApiProperty()
  nextIntervalInDays: number;

  @ApiProperty()
  betweenDosesReport: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  prescriptionId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  plannedStepId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  administeredStepId?: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  plannedValues?: unknown;

  @ApiPropertyOptional({ type: Object, nullable: true })
  administeredValues?: unknown;

  @ApiPropertyOptional({ type: Object, nullable: true })
  recommendation?: unknown;

  @ApiPropertyOptional({ enum: DoseImmediateConduct, nullable: true })
  immediateConduct?: DoseImmediateConduct | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  immediateConductJustification?: string | null;

  @ApiProperty()
  isArchived: boolean;

  @ApiProperty({ type: String, nullable: true })
  administeredById: string | null;

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  updatedById: string;

  @ApiProperty({ type: String, nullable: true })
  archivedById: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archivedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}
