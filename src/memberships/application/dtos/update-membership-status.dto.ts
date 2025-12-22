import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMembershipStatusDto {
  @ApiProperty({ description: 'Status ativo/inativo' })
  @IsNotEmpty()
  @IsBoolean()
  isActive: boolean;
}

