import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class RoleResponseDto {
  @ApiProperty({ description: 'ID da concessão de role' })
  id: string;

  @ApiProperty({ enum: Role, description: 'Role concedida' })
  role: Role;

  @ApiProperty({ description: 'ID do profissional' })
  professionalId: string;

  @ApiProperty({ description: 'Data da concessão', format: 'date-time' })
  grantedAt: Date;

  @ApiProperty({ description: 'ID de quem concedeu' })
  grantedById: string;

  @ApiProperty({
    description: 'Data da revogação',
    required: false,
    nullable: true,
    format: 'date-time',
    type: String,
  })
  revokedAt: Date | null;

  @ApiProperty({
    description: 'ID de quem revogou',
    required: false,
    nullable: true,
    type: String,
  })
  revokedById: string | null;
}
