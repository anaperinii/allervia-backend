import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ResolvedPrescriptionInputDto } from '../../protocol-catalog/protocol-catalog.dto';

export class PrescriptionRevisionDto {
  @ApiProperty() @IsString() @IsNotEmpty() targetVersionId: string;

  @ApiProperty({
    type: ResolvedPrescriptionInputDto,
    description:
      'Resolved prescription over the target version (stepIds, starting, target)',
  })
  @IsObject()
  prescription: Record<string, unknown>;

  @ApiProperty({
    description: 'Step of the target version assigned to the pending dose',
  })
  @IsString()
  @IsNotEmpty()
  pendingStepId: string;

  @ApiProperty({ description: 'Clinical reason for the revision' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

  @ApiProperty() @IsInt() @Min(0) expectedRevision: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({
    description:
      'Stable key reused for retries of this exact command. Only effective when dryRun is false: repeating the same key and body returns the original result without creating a second snapshot; the same key with a different body is rejected with 409 IDEMPOTENCY_KEY_REUSED. Ignored on dry-run.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey?: string;
}
