import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from '@nestjs/class-validator';
import { IsNotEmpty } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateProfessionalRoleDto {
  @ApiProperty({ description: 'Papel concedido', enum: Role })
  @IsNotEmpty()
  @IsEnum(Role, { message: 'Role especificada inválida' })
  name: Role;

  @ApiProperty({ description: 'ID do profissional que recebe o papel' })
  @IsString()
  @IsNotEmpty()
  professionalId: string;
}
