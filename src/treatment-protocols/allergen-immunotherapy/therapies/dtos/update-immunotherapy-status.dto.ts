import { IsEnum, IsNotEmpty, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TherapyStatus } from '@prisma/client';

export class UpdateImmunotherapyStatusDto {
  @ApiProperty() @IsInt() @Min(0) expectedRevision: number;
  @ApiProperty({ description: 'Status' })
  @IsEnum(TherapyStatus, { message: 'Status inválido fornecido.' })
  @IsNotEmpty()
  status: TherapyStatus;
}
