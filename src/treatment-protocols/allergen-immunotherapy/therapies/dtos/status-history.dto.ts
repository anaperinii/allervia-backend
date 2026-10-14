import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';

export class StatusHistoryQueryDto {
  @ApiProperty({ example: '2026-01-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from: string;

  @ApiProperty({ example: '2026-12-31' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to: string;

  @ApiProperty({ example: 'America/Sao_Paulo' })
  @IsString()
  timeZone: string;

  @ApiProperty({ enum: ['week', 'month'] })
  @IsIn(['week', 'month'])
  granularity: 'week' | 'month';
}

export class StatusHistoryBucketDto {
  @ApiProperty() date: string;
  @ApiProperty() label: string;
  @ApiProperty() active: number;
  @ApiProperty() suspended: number;
  @ApiProperty() completed: number;
  @ApiProperty() unknown: number;
}

export class StatusHistoryResponseDto {
  @ApiProperty() asOf: string;
  @ApiProperty() timeZone: string;
  @ApiProperty() complete: boolean;
  @ApiProperty() totalTherapies: number;
  @ApiProperty({ type: [StatusHistoryBucketDto] })
  buckets: StatusHistoryBucketDto[];
}

export class PatientClinicalRecordDto {
  @ApiProperty({ type: [String] }) redactedFields: string[];
  @ApiProperty() asOf: string;
  @ApiProperty() complete: boolean;
  @ApiProperty({ type: 'object', additionalProperties: true }) patient: Record<
    string,
    unknown
  >;
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  therapies: Record<string, unknown>[];
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  history: Record<string, unknown>[];
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  appointments: Record<string, unknown>[];
}
