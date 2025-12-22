import { IsEnum, IsNotEmpty } from '@nestjs/class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DoseStatus } from '@prisma/client';

export class UpdateDoseStatusDto {
  @ApiProperty({ description: 'Status' })
  @IsEnum(DoseStatus, { message: 'Status inválido fornecido.' })
  @IsNotEmpty()
  status: DoseStatus;
}

