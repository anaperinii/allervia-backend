import { ApiProperty } from '@nestjs/swagger';
import { DoseResponseDto } from './dose-response.dto';

export class RevisionPendingStepDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label: string;

  @ApiProperty({ type: String, description: 'Denominador da diluição' })
  concentration: string;

  @ApiProperty({ type: String, description: 'Volume em decimal exato' })
  volume: string;

  @ApiProperty()
  intervalDays: number;
}

export class PrescriptionRevisionPreviewDto {
  @ApiProperty({ oneOf: [{ type: 'boolean', enum: [true] }] })
  dryRun: true;

  @ApiProperty()
  therapyId: string;

  @ApiProperty()
  pendingDoseId: string;

  @ApiProperty()
  previousVersionId: string;

  @ApiProperty()
  targetVersionId: string;

  @ApiProperty({ type: RevisionPendingStepDto })
  pendingStep: RevisionPendingStepDto;

  @ApiProperty({ type: String, format: 'date-time' })
  scheduledAtUnchanged: string;

  @ApiProperty({ type: Boolean, example: true })
  historicalDosesUnchanged: true;
}

export class PrescriptionRevisionAppliedDto {
  @ApiProperty({ oneOf: [{ type: 'boolean', enum: [false] }] })
  dryRun: false;

  @ApiProperty()
  prescriptionId: string;

  @ApiProperty()
  previousPrescriptionId: string;

  @ApiProperty({ type: DoseResponseDto })
  pendingDose: DoseResponseDto;

  @ApiProperty({ description: 'Revisão de concorrência após a troca' })
  therapyRevision: number;
}
