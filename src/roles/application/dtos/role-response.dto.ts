import { ApiProperty } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';

export class RoleResponseDto {
  @ApiProperty({ description: 'ID do role' })
  id: string;

  @ApiProperty({ description: 'Nome do role' })
  name: RoleType;

  @ApiProperty({ description: 'Descrição do role', required: false })
  description: string | null;

  @ApiProperty({ description: 'Indica se o role está ativo' })
  isActive: boolean;

  @ApiProperty({ description: 'Data de criação do role' })
  createdAt: Date;

  @ApiProperty({ description: 'Data da última atualização do role' })
  updatedAt: Date;
}

