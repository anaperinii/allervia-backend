import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdministrationRoute,
  ProtocolVersionStatus,
  TherapyStatus,
} from '@prisma/client';
import {
  IsString,
  IsNotEmpty,
  IsObject,
  IsInt,
  Min,
  IsBoolean,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class ProtocolStepDefinitionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label: string;

  @ApiProperty({ enum: ['BUILD_UP', 'MAINTENANCE'] })
  phase: 'BUILD_UP' | 'MAINTENANCE';

  @ApiProperty({ type: String, description: 'Denominador da diluição' })
  concentration: string;

  @ApiProperty({ type: String, description: 'Volume em decimal exato' })
  volume: string;

  @ApiProperty()
  intervalDays: number;

  @ApiProperty({ type: String, nullable: true })
  nextStepId: string | null;
}

export class ProtocolDefinitionDto {
  @ApiProperty({ enum: [1] })
  schemaVersion: number;

  @ApiProperty({ enum: ['1'] })
  engineVersion: string;

  @ApiProperty({ enum: ['SUBCUTANEOUS'] })
  route: string;

  @ApiProperty({ enum: ['mL'] })
  volumeUnit: string;

  @ApiProperty({ enum: ['DILUTION_DENOMINATOR'] })
  concentrationUnit: string;

  @ApiProperty({ type: [ProtocolStepDefinitionDto] })
  steps: ProtocolStepDefinitionDto[];
}

export class ResolvedPrescriptionInputDto {
  @ApiProperty()
  protocolId: string;

  @ApiProperty()
  protocolVersionId: string;

  @ApiProperty({ enum: ['SUBCUTANEOUS'] })
  route: string;

  @ApiProperty({ type: [String] })
  stepIds: string[];

  @ApiProperty()
  startingStepId: string;

  @ApiProperty()
  targetStepId: string;
}

export class AdministeredValuesInputDto {
  @ApiProperty({ type: String, description: 'Denominador da diluição' })
  concentration: string;

  @ApiProperty({ type: String, description: 'Volume em decimal exato' })
  volume: string;

  @ApiProperty()
  intervalDays: number;

  @ApiProperty({ enum: ['SUBCUTANEOUS'] })
  route: string;

  @ApiProperty({ enum: ['mL'] })
  volumeUnit: string;

  @ApiProperty({ enum: ['DILUTION_DENOMINATOR'] })
  concentrationUnit: string;

  @ApiPropertyOptional({ enum: ['BUILD_UP', 'MAINTENANCE'] })
  phase?: 'BUILD_UP' | 'MAINTENANCE';
}

export class CreateProtocolDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(160) name: string;
  @ApiProperty({
    type: ProtocolDefinitionDto,
    description:
      'SCIT definition with explicit steps; server assigns protocol/version identity. Validated by the clinical engine on publish.',
  })
  @IsObject()
  definition: Record<string, unknown>;
}
export class CreateProtocolVersionDto {
  @ApiProperty({
    type: ProtocolDefinitionDto,
    description: 'Validated by the clinical engine on publish',
  })
  @IsObject()
  definition: Record<string, unknown>;
}
export class EditProtocolVersionDto extends CreateProtocolVersionDto {
  @ApiProperty() @IsInt() @Min(0) expectedRevision: number;
}
export class ProtocolRevisionDto {
  @ApiProperty() @IsInt() @Min(0) expectedRevision: number;
}
export class SimulateProtocolDto {
  @ApiProperty({ type: ResolvedPrescriptionInputDto })
  @IsObject()
  prescription: Record<string, unknown>;
  @ApiProperty({ type: AdministeredValuesInputDto })
  @IsObject()
  administered: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsString() stepId?: string;
}
export class AutomationSettingsDto {
  @ApiProperty() @IsBoolean() enabled: boolean;
  @ApiProperty() @IsString() @IsNotEmpty() timeZone: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRevision?: number;
}

export class BindLegacyProtocolDto {
  @ApiProperty() @IsString() @IsNotEmpty() versionId: string;
  @ApiProperty({ type: ResolvedPrescriptionInputDto })
  @IsObject()
  prescription: Record<string, unknown>;
  @ApiProperty() @IsInt() @Min(0) expectedRevision: number;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class ProtocolVersionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  protocolId: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  number: number;

  @ApiProperty({ enum: ProtocolVersionStatus })
  status: ProtocolVersionStatus;

  @ApiProperty({
    type: ProtocolDefinitionDto,
    description:
      'Payload armazenado; versões publicadas também carregam protocolId, versionId, version e status',
  })
  definition: unknown;

  @ApiProperty()
  schemaVersion: number;

  @ApiProperty()
  engineVersion: string;

  @ApiProperty({ description: 'Revisão de concorrência da versão' })
  revision: number;

  @ApiProperty()
  createdById: string;

  @ApiProperty({ type: String, nullable: true })
  publishedById: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  publishedAt: Date | null;
}

export class TreatmentProtocolSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: AdministrationRoute })
  route: AdministrationRoute;

  @ApiProperty()
  available: boolean;

  @ApiProperty()
  createdById: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class TreatmentProtocolDto extends TreatmentProtocolSummaryDto {
  @ApiProperty({ type: [ProtocolVersionDto] })
  versions: ProtocolVersionDto[];
}

export class CreateProtocolResultDto {
  @ApiProperty({ type: TreatmentProtocolSummaryDto })
  protocol: TreatmentProtocolSummaryDto;

  @ApiProperty({ type: ProtocolVersionDto })
  version: ProtocolVersionDto;
}

export class DiscardDraftResultDto {
  @ApiProperty()
  discardedVersionId: string;

  @ApiProperty({
    description: 'Verdadeiro quando a última versão removeu o protocolo',
  })
  protocolRemoved: boolean;
}

export class AutomationSettingsResultDto {
  @ApiProperty()
  enabled: boolean;

  @ApiProperty()
  timeZone: string;

  @ApiProperty()
  revision: number;
}

export class ProtocolDefaultDto {
  @ApiProperty()
  organizationId: string;

  @ApiProperty({ enum: AdministrationRoute })
  route: AdministrationRoute;

  @ApiProperty()
  versionId: string;
}

export class AutomationSettingsViewDto extends AutomationSettingsResultDto {
  @ApiProperty({ type: [ProtocolDefaultDto] })
  defaults: ProtocolDefaultDto[];
}

export class SimulationValuesDto {
  @ApiProperty({ type: String, description: 'Denominador da diluição' })
  concentration: string;

  @ApiProperty({ type: String, description: 'Volume em decimal exato' })
  volume: string;

  @ApiProperty()
  intervalDays: number;

  @ApiPropertyOptional({ enum: ['BUILD_UP', 'MAINTENANCE'] })
  phase?: 'BUILD_UP' | 'MAINTENANCE';

  @ApiProperty({ enum: ['SUBCUTANEOUS'] })
  route: 'SUBCUTANEOUS';

  @ApiProperty({ enum: ['mL'] })
  volumeUnit: 'mL';

  @ApiProperty({ enum: ['DILUTION_DENOMINATOR'] })
  concentrationUnit: 'DILUTION_DENOMINATOR';
}

export class SimulationRecommendedDto {
  @ApiProperty({ enum: ['RECOMMENDED'] })
  kind: 'RECOMMENDED';

  @ApiProperty()
  protocolVersionId: string;

  @ApiProperty()
  fromStepId: string;

  @ApiProperty()
  stepId: string;

  @ApiProperty()
  label: string;

  @ApiProperty({ enum: ['BUILD_UP', 'MAINTENANCE'] })
  phase: 'BUILD_UP' | 'MAINTENANCE';

  @ApiProperty({ type: SimulationValuesDto })
  values: SimulationValuesDto;
}

export class SimulationEndOfSequenceDto {
  @ApiProperty({ enum: ['END_OF_SEQUENCE'] })
  kind: 'END_OF_SEQUENCE';

  @ApiProperty()
  protocolVersionId: string;

  @ApiProperty()
  fromStepId: string;
}

export class SimulationUnresolvedDto {
  @ApiProperty({ enum: ['UNRESOLVED'] })
  kind: 'UNRESOLVED';

  @ApiProperty({
    enum: [
      'INVALID_PROTOCOL',
      'INVALID_PRESCRIPTION',
      'INVALID_ADMINISTERED_VALUES',
      'CONTEXT_MISMATCH',
      'STEP_NOT_IN_PRESCRIPTION',
      'STEP_VALUE_MISMATCH',
      'VALUE_NOT_CONFIGURED',
      'AMBIGUOUS_VALUE',
    ],
  })
  code: string;
}

export class MigrationPatientRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  isActive: boolean;
}

export class MigrationTargetDto {
  @ApiProperty({ type: String, description: 'Denominador da diluição' })
  concentration: string;

  @ApiProperty({ type: String, description: 'Volume em decimal exato' })
  volume: string;
}

export class MigrationPendingDoseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: String, format: 'date-time' })
  scheduledAt: Date;

  @ApiProperty({ type: String })
  concentration: string;

  @ApiProperty({ type: String })
  volume: string;

  @ApiProperty()
  intervalDays: number;
}

export class MigrationDecimalDto {
  @ApiProperty()
  doseId: string;

  @ApiProperty()
  storedVolumeText: string;

  @ApiProperty()
  decimalText: string;

  @ApiProperty()
  exactCandidate: boolean;

  @ApiProperty()
  historicalRecordUnchanged: boolean;
}

export class MigrationTherapyReportDto {
  @ApiProperty()
  therapyId: string;

  @ApiProperty()
  revision: number;

  @ApiProperty({ type: String, nullable: true })
  prescriptionId: string | null;

  @ApiProperty({ type: MigrationPatientRefDto })
  patient: MigrationPatientRefDto;

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

  @ApiProperty({ type: MigrationTargetDto })
  target: MigrationTargetDto;

  @ApiProperty({ type: [MigrationPendingDoseDto] })
  pendingDoses: MigrationPendingDoseDto[];

  @ApiProperty({ type: [String] })
  pendingDoseIds: string[];

  @ApiProperty({ type: [String] })
  issues: string[];

  @ApiProperty({ type: [MigrationDecimalDto] })
  decimals: MigrationDecimalDto[];
}

export class OriginDraftStepDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label: string;

  @ApiProperty({ enum: ['BUILD_UP', 'MAINTENANCE'] })
  phase: string;

  @ApiProperty({ type: String })
  concentration: string;

  @ApiProperty({ type: String })
  volume: string;

  @ApiProperty()
  intervalDays: number;

  @ApiProperty({ type: String, nullable: true })
  nextStepId: string | null;
}

export class OriginDraftDefinitionDto {
  @ApiProperty({ enum: [1] })
  schemaVersion: number;

  @ApiProperty({ enum: ['1'] })
  engineVersion: string;

  @ApiProperty({ enum: ['SUBCUTANEOUS'] })
  route: string;

  @ApiProperty({ enum: ['mL'] })
  volumeUnit: string;

  @ApiProperty({ enum: ['DILUTION_DENOMINATOR'] })
  concentrationUnit: string;

  @ApiProperty({ enum: ['LEGACY_INVENTORY_NOT_CLINICALLY_APPROVED'] })
  provenance: string;

  @ApiProperty({ type: Boolean, example: true })
  requiresClinicalTransitionReview: boolean;

  @ApiProperty({ type: [OriginDraftStepDto] })
  steps: OriginDraftStepDto[];
}

export class MigrationInventoryDto {
  @ApiProperty({ type: [MigrationTherapyReportDto] })
  report: MigrationTherapyReportDto[];

  @ApiProperty({ type: OriginDraftDefinitionDto })
  originDraft: OriginDraftDefinitionDto;

  @ApiProperty({ type: Boolean, example: true })
  dryRun: boolean;
}

export class BindLegacyDryRunResultDto {
  @ApiProperty({ oneOf: [{ type: 'boolean', enum: [true] }] })
  dryRun: true;

  @ApiProperty()
  therapyId: string;

  @ApiProperty()
  doseId: string;

  @ApiProperty()
  stepId: string;

  @ApiProperty({ type: Boolean, example: true })
  historicalDosesUnchanged: boolean;
}

export class BindLegacyResultDto {
  @ApiProperty()
  prescriptionId: string;

  @ApiProperty({
    description: 'Verdadeiro quando a prescrição idêntica já estava vinculada',
  })
  alreadyBound: boolean;
}
