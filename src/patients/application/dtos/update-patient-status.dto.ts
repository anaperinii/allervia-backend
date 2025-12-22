import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePatientStatusDto {
  @ApiProperty({ description: 'Status ativo/inativo' })
  @IsNotEmpty()
  @IsBoolean()
  status: boolean;
}

