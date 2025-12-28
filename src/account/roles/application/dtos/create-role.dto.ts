import { ApiProperty } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from '@nestjs/class-validator';
import { IsNotEmpty } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ description: 'Nome do role' })
  @IsNotEmpty()
  @IsEnum(RoleType, { message: 'Role especificada inválida' })
  name: RoleType;

  @ApiProperty({ description: 'Descrição do role', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'ID da organização'})
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ description: 'Key para register via first onboarding'})
  @IsString()
  @IsNotEmpty()
  key: string;
}

