import { ApiProperty } from '@nestjs/swagger';
import { LifecycleAuthorDto } from './therapy-lifecycle-response.dto';

export class ClinicalHistoryEntryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  action: string;

  @ApiProperty()
  entityType: string;

  @ApiProperty()
  entityId: string;

  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  newValues: unknown;

  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  oldValues: unknown;

  @ApiProperty({ type: String, format: 'date-time' })
  timestamp: Date;

  @ApiProperty({ type: LifecycleAuthorDto })
  user: LifecycleAuthorDto;
}

export class ClinicalHistoryResponseDto {
  @ApiProperty()
  therapyId: string;

  @ApiProperty({ type: [ClinicalHistoryEntryDto] })
  entries: ClinicalHistoryEntryDto[];
}
