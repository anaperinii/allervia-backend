import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

/** Prescription parameters cannot be changed through a generic PATCH. */
export class UpdateImmunotherapyDto {
  @ApiProperty() @IsInt() @Min(0) expectedRevision: number;
  @ApiProperty() @IsString() @IsNotEmpty() immunoType: string;
}
