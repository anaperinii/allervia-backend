import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from '@nestjs/class-validator';
import { IsNotEmpty } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateProfessionalRoleDto {
  @ApiProperty({ description: 'Nome do role' })
  @IsNotEmpty()
  @IsEnum(Role, { message: 'Role especificada inválida' })
  name: Role;

  @ApiProperty({ description: 'ID do professional a ser vinculado'})
  @IsString()
  @IsNotEmpty()
  professionalId: string;

  @ApiProperty({ description: 'Key para register via first onboarding'})
  @IsString()
  @IsNotEmpty()
  key: string;
}

