import { IsDateString, IsNotEmpty, IsNumber, IsString, Min, Max, Matches } from '@nestjs/class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePatientDto {
  @ApiProperty({ description: 'Nome completo' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ description: 'Data de Nascimento' })
  @IsDateString({ strict: true })
  @IsNotEmpty()
  birthDate: Date;

  @ApiProperty({ description: 'Peso em kg' })
  @IsNumber()
  @Min(0.1, { message: 'Peso deve ser maior que zero' })
  @Max(500, { message: 'Peso inválido. Valor muito alto.' })
  weightInKg: number;

  @ApiProperty({ description: 'Número de Telefone' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10,11}$/, { message: 'Número de telefone inválido. Deve conter 10 ou 11 dígitos.' })
  phoneNumber: string;
}

