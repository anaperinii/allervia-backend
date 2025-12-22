import { IsBoolean, IsOptional, IsString } from '@nestjs/class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiProperty({ description: 'Descrição do role', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

