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

export class PrescriptionRevisionDto {
  @ApiProperty() @IsString() @IsNotEmpty() targetVersionId: string;

  @ApiProperty({
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
}
