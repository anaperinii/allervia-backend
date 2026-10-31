import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  AdministrationRoute,
  DoseImmediateConduct,
  DoseObservationPhase,
  DoseStatus,
  ProtocolVersionStatus,
  TherapyStatus,
} from '@prisma/client';

export class DoseValuesResponseDto {
  @ApiProperty({
    example: '1000',
    description: 'Exact decimal dilution denominator',
  })
  concentration: string;

  @ApiProperty({ example: '0.2', description: 'Exact decimal mL' })
  volume: string;

  @ApiProperty()
  intervalDays: number;

  @ApiProperty({ enum: ['BUILD_UP', 'MAINTENANCE'] })
  phase: 'BUILD_UP' | 'MAINTENANCE';

  @ApiProperty({ enum: ['SUBCUTANEOUS'] })
  route: 'SUBCUTANEOUS';

  @ApiProperty({ enum: ['mL'] })
  volumeUnit: 'mL';

  @ApiProperty({ enum: ['DILUTION_DENOMINATOR'] })
  concentrationUnit: 'DILUTION_DENOMINATOR';
}

export class ProtocolStepResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label: string;

  @ApiProperty({ enum: ['BUILD_UP', 'MAINTENANCE'] })
  phase: 'BUILD_UP' | 'MAINTENANCE';

  @ApiProperty({ type: String, nullable: true })
  nextStepId: string | null;

  @ApiProperty({
    example: '1000',
    description: 'Exact decimal dilution denominator',
  })
  concentration: string;

  @ApiProperty({ example: '0.2', description: 'Exact decimal mL' })
  volume: string;

  @ApiProperty()
  intervalDays: number;
}

export class DoseRecommendationRecommendedDto {
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

  @ApiProperty({ type: DoseValuesResponseDto })
  values: DoseValuesResponseDto;
}

export class DoseRecommendationEndOfSequenceDto {
  @ApiProperty({ enum: ['END_OF_SEQUENCE'] })
  kind: 'END_OF_SEQUENCE';

  @ApiProperty()
  protocolVersionId: string;

  @ApiProperty()
  fromStepId: string;
}

const RECOMMENDATION_VARIANTS = [
  { $ref: getSchemaPath(DoseRecommendationRecommendedDto) },
  { $ref: getSchemaPath(DoseRecommendationEndOfSequenceDto) },
];

@ApiExtraModels(
  DoseRecommendationRecommendedDto,
  DoseRecommendationEndOfSequenceDto,
)
export class DoseRecordDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  timeZone?: string | null;
  @ApiProperty()
  id: string;

  @ApiProperty()
  immunotherapyId: string;

  @ApiProperty({ type: String, nullable: true })
  administeredById: string | null;

  @ApiProperty({ description: 'Dilution denominator stored as integer' })
  concentration: number;

  @ApiProperty({
    type: String,
    example: '0.2',
    description: 'Exact decimal mL serialized as string',
  })
  volume: string;

  @ApiProperty()
  scheduledAt: Date;

  @ApiProperty({ type: Date, nullable: true })
  administeredAt: Date | null;

  @ApiProperty()
  nextIntervalInDays: number;

  @ApiProperty()
  betweenDosesReport: string;

  @ApiProperty({ type: Date, nullable: true })
  administrationEndedAt: Date | null;

  @ApiProperty({ enum: DoseImmediateConduct, nullable: true })
  immediateConduct: DoseImmediateConduct | null;

  @ApiProperty({ type: String, nullable: true })
  immediateConductJustification: string | null;

  @ApiProperty({ enum: DoseStatus })
  status: DoseStatus;

  @ApiProperty()
  isArchived: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  updatedById: string;

  @ApiProperty({ type: Date, nullable: true })
  archivedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  archivedById: string | null;

  @ApiProperty({ type: String, nullable: true })
  prescriptionId: string | null;

  @ApiProperty({ type: String, nullable: true })
  plannedStepId: string | null;

  @ApiProperty({ type: String, nullable: true })
  administeredStepId: string | null;

  @ApiProperty({ type: DoseValuesResponseDto, nullable: true })
  plannedValues: DoseValuesResponseDto | null;

  @ApiProperty({ type: DoseValuesResponseDto, nullable: true })
  administeredValues: DoseValuesResponseDto | null;

  @ApiProperty({ type: String, nullable: true })
  sourceDoseId: string | null;

  @ApiProperty({ oneOf: RECOMMENDATION_VARIANTS, nullable: true })
  recommendation:
    | DoseRecommendationRecommendedDto
    | DoseRecommendationEndOfSequenceDto
    | null;

  @ApiProperty()
  revision: number;
}

export class DoseObservationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  doseId: string;

  @ApiProperty({ enum: DoseObservationPhase })
  phase: DoseObservationPhase;

  @ApiProperty({ type: [String] })
  reportedSideEffects: string[];

  @ApiProperty({ type: [String] })
  administeredMedications: string[];

  @ApiProperty({ type: String, nullable: true })
  notes: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class DoseObservationAddendumResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  doseId: string;

  @ApiProperty({ type: [String] })
  reportedSideEffects: string[];

  @ApiProperty({ type: [String] })
  administeredMedications: string[];

  @ApiProperty({ type: String, nullable: true })
  notes: string | null;

  @ApiProperty()
  observedAt: Date;

  @ApiProperty({ enum: DoseImmediateConduct, nullable: true })
  conduct: DoseImmediateConduct | null;

  @ApiProperty({ type: String, nullable: true })
  conductJustification: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  createdById: string;
}

export class DoseResolvedPrescriptionDto {
  @ApiProperty()
  protocolId: string;

  @ApiProperty()
  protocolVersionId: string;

  @ApiProperty({ enum: ['SUBCUTANEOUS'] })
  route: 'SUBCUTANEOUS';

  @ApiProperty({ type: [String] })
  stepIds: string[];

  @ApiProperty()
  startingStepId: string;

  @ApiProperty()
  targetStepId: string;

  @ApiProperty({ description: 'IANA time zone of the prescription calendar' })
  timeZone: string;
}

export class DoseProtocolVersionDto {
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
    type: 'object',
    additionalProperties: true,
    description: 'Stored protocol definition payload',
  })
  definition: Record<string, unknown>;

  @ApiProperty()
  schemaVersion: number;

  @ApiProperty()
  engineVersion: string;

  @ApiProperty()
  revision: number;

  @ApiProperty()
  createdById: string;

  @ApiProperty({ type: String, nullable: true })
  publishedById: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: Date, nullable: true })
  publishedAt: Date | null;
}

export class DosePrescriptionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  immunotherapyId: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  versionId: string;

  @ApiProperty({ type: DoseResolvedPrescriptionDto })
  resolved: DoseResolvedPrescriptionDto;

  @ApiProperty()
  revision: number;

  @ApiProperty({ type: String, nullable: true })
  revisionReason: string | null;

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: DoseProtocolVersionDto })
  version: DoseProtocolVersionDto;
}

export class DoseTherapyDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  patientId: string;

  @ApiProperty()
  immunoType: string;

  @ApiProperty({ enum: AdministrationRoute })
  administrationRoute: AdministrationRoute;

  @ApiProperty()
  extract: string;

  @ApiProperty()
  inductionStartDate: Date;

  @ApiProperty({ type: Date, nullable: true })
  maintenanceStartDate: Date | null;

  @ApiProperty()
  targetConcentration: number;

  @ApiProperty({
    type: String,
    example: '0.5',
    description: 'Exact decimal mL serialized as string',
  })
  targetVolume: string;

  @ApiProperty({ enum: TherapyStatus })
  status: TherapyStatus;

  @ApiProperty()
  isArchived: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  updatedById: string;

  @ApiProperty({ type: Date, nullable: true })
  archivedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  archivedById: string | null;

  @ApiProperty({ type: String, nullable: true })
  currentPrescriptionId: string | null;

  @ApiProperty()
  revision: number;

  @ApiProperty({ type: DosePrescriptionDto, nullable: true })
  currentPrescription: DosePrescriptionDto | null;
}

export class DoseDetailResponseDto extends DoseRecordDto {
  @ApiProperty({ type: DoseTherapyDto })
  immunotherapy: DoseTherapyDto;

  @ApiProperty({ type: [DoseObservationResponseDto] })
  observations: DoseObservationResponseDto[];

  @ApiProperty({ type: [DoseObservationAddendumResponseDto] })
  observationAddenda: DoseObservationAddendumResponseDto[];

  @ApiProperty({ type: String, nullable: true })
  protocolVersionId: string | null;

  @ApiProperty({ type: Number, nullable: true })
  prescriptionRevision: number | null;

  @ApiProperty()
  therapyRevision: number;

  @ApiProperty({ type: [ProtocolStepResponseDto] })
  allowedValues: ProtocolStepResponseDto[];

  @ApiProperty()
  migrationRequired: boolean;
}

export class UpdateScheduledDoseResponseDto extends DoseRecordDto {
  @ApiProperty()
  therapyRevision: number;
}

@ApiExtraModels(
  DoseRecommendationRecommendedDto,
  DoseRecommendationEndOfSequenceDto,
)
export class DosePreviewResponseDto {
  @ApiProperty({ oneOf: RECOMMENDATION_VARIANTS })
  recommendation:
    | DoseRecommendationRecommendedDto
    | DoseRecommendationEndOfSequenceDto;

  @ApiProperty({ type: [ProtocolStepResponseDto] })
  allowedValues: ProtocolStepResponseDto[];

  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'Null when the recommendation ends the sequence',
  })
  nextScheduledAt: Date | null;

  @ApiProperty()
  expectedRevision: number;

  @ApiProperty()
  expectedTherapyRevision: number;

  @ApiProperty()
  prescriptionRevision: number;

  @ApiProperty()
  protocolVersionId: string;
}

@ApiExtraModels(
  DoseRecommendationRecommendedDto,
  DoseRecommendationEndOfSequenceDto,
)
export class AdministerDoseResponseDto {
  @ApiProperty({ type: DoseRecordDto })
  dose: DoseRecordDto;

  @ApiProperty({
    type: DoseRecordDto,
    nullable: true,
    description: 'Scheduled successor; null at end of sequence',
  })
  successor: DoseRecordDto | null;

  @ApiProperty({ oneOf: RECOMMENDATION_VARIANTS })
  recommendation:
    | DoseRecommendationRecommendedDto
    | DoseRecommendationEndOfSequenceDto;

  @ApiProperty()
  therapyRevision: number;
}

export class RetractDoseResponseDto {
  @ApiProperty({ type: DoseRecordDto })
  dose: DoseRecordDto;

  @ApiProperty({ type: String, nullable: true })
  archivedSuccessorId: string | null;

  @ApiProperty({ type: DoseRecordDto })
  reissuedDose: DoseRecordDto;

  @ApiProperty()
  therapyRevision: number;
}

export class LateObservationResponseDto {
  @ApiProperty({ type: DoseObservationAddendumResponseDto })
  addendum: DoseObservationAddendumResponseDto;

  @ApiProperty({ type: String, nullable: true })
  suspensionEventId: string | null;
}

export class SchedulePhysicianSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;
}

export class SchedulePatientSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: SchedulePhysicianSummaryDto })
  responsiblePhysician: SchedulePhysicianSummaryDto;
}

export class ScheduleTherapySummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  immunoType: string;

  @ApiProperty()
  extract: string;

  @ApiProperty({ enum: TherapyStatus })
  status: TherapyStatus;

  @ApiProperty()
  revision: number;

  @ApiProperty({ type: SchedulePatientSummaryDto })
  patient: SchedulePatientSummaryDto;
}

export class ScheduleDoseItemDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  timeZone?: string | null;
  @ApiProperty()
  id: string;

  @ApiProperty()
  immunotherapyId: string;

  @ApiProperty({ enum: DoseStatus })
  status: DoseStatus;

  @ApiProperty()
  scheduledAt: Date;

  @ApiProperty({ type: Date, nullable: true })
  administeredAt: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  administrationEndedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  plannedStepId: string | null;

  @ApiProperty({ type: String, nullable: true })
  administeredStepId: string | null;

  @ApiProperty({ type: DoseValuesResponseDto, nullable: true })
  plannedValues: DoseValuesResponseDto | null;

  @ApiProperty({ type: DoseValuesResponseDto, nullable: true })
  administeredValues: DoseValuesResponseDto | null;

  @ApiProperty()
  revision: number;

  @ApiProperty({ type: ScheduleTherapySummaryDto })
  immunotherapy: ScheduleTherapySummaryDto;
}

export class DoseMetricsByDayDto {
  @ApiProperty({
    example: '2026-01-05',
    description: 'Local calendar day in the organization time zone',
  })
  day: string;

  @ApiProperty()
  count: number;
}

export class DoseMetricsApplicationsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  onSchedule: number;

  @ApiProperty()
  offSchedule: number;

  @ApiProperty({ type: [DoseMetricsByDayDto] })
  byDay: DoseMetricsByDayDto[];
}

export class DoseMetricsScheduledDto {
  @ApiProperty()
  pending: number;

  @ApiProperty()
  overdue: number;
}

export class DoseMetricsAdherenceDto {
  @ApiProperty({ description: 'Applications administered on schedule' })
  numerator: number;

  @ApiProperty({ description: 'Applications administered in the period' })
  denominator: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 1,
    description: 'numerator/denominator; null when denominator is 0',
  })
  ratio: number | null;
}

export class DoseMetricsTherapiesDto {
  @ApiProperty()
  inProgress: number;

  @ApiProperty()
  suspended: number;

  @ApiProperty()
  completed: number;

  @ApiProperty()
  buildUp: number;

  @ApiProperty()
  maintenance: number;
}

export class DoseMetricsResponseDto {
  @ApiProperty({ format: 'date-time' })
  from: string;

  @ApiProperty({ format: 'date-time' })
  to: string;

  @ApiProperty({ description: 'IANA time zone used for daily grouping' })
  timeZone: string;

  @ApiProperty({ type: DoseMetricsApplicationsDto })
  applications: DoseMetricsApplicationsDto;

  @ApiProperty({ type: DoseMetricsScheduledDto })
  scheduled: DoseMetricsScheduledDto;

  @ApiProperty({ type: DoseMetricsAdherenceDto })
  adherence: DoseMetricsAdherenceDto;

  @ApiProperty({ type: DoseMetricsTherapiesDto })
  therapies: DoseMetricsTherapiesDto;
}
