import { ApiProperty } from '@nestjs/swagger';
import { Profession } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProfessionalDto {
  @ApiProperty({ description: 'Nome completo do profissional' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ description: 'Telefone de contato' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ description: 'Profissão', enum: Profession })
  @IsEnum(Profession, { message: 'Profissão inválida' })
  profession: Profession;

  @ApiProperty({ description: 'Número do conselho', required: false })
  @IsString()
  @IsOptional()
  councilNumber?: string;

  @ApiProperty({ description: 'UF do conselho', required: false })
  @IsString()
  @IsOptional()
  councilUf?: string;
}
