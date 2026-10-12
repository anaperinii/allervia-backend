import { ApiProperty } from '@nestjs/swagger';

export class AuditLogDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  entityType: string;

  @ApiProperty()
  entityId: string;

  @ApiProperty()
  action: string;

  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  oldValues: Record<string, unknown> | null;

  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  newValues: Record<string, unknown> | null;

  @ApiProperty({ type: [String] })
  changedFields: string[];

  @ApiProperty({ type: String, nullable: true })
  sessionId: string | null;

  @ApiProperty({ format: 'date-time' })
  timestamp: Date;
}
