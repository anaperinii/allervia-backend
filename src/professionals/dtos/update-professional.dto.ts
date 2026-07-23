import { ApiProperty } from '@nestjs/swagger';
import { Profession } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateProfessionalDto {
  @ApiProperty({ description: 'Nome completo do profissional', required: false })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiProperty({ description: 'Telefone de contato', required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ description: 'Profissão', enum: Profession, required: false })
  @IsEnum(Profession, { message: 'Profissão inválida' })
  @IsOptional()
  profession?: Profession;

  @ApiProperty({ description: 'Número do conselho', required: false })
  @IsString()
  @IsOptional()
  councilNumber?: string;

  @ApiProperty({ description: 'UF do conselho', required: false })
  @IsString()
  @IsOptional()
  councilUf?: string;
}
