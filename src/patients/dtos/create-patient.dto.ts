import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  Max,
  Matches,
} from '@nestjs/class-validator';
import { IsOptional, Validate } from 'class-validator';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { isValidCpf } from '../cpf';

@ValidatorConstraint({ name: 'cpf', async: false })
export class CpfConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidCpf(value);
  }

  defaultMessage(): string {
    return 'CPF inválido.';
  }
}

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
  @Matches(/^\d{10,11}$/, {
    message: 'Número de telefone inválido. Deve conter 10 ou 11 dígitos.',
  })
  phoneNumber: string;

  @ApiPropertyOptional({
    description:
      'CPF do paciente, com ou sem máscara. Ausente quando a pessoa não possui CPF conhecido — a ausência é registrada, nunca inventada.',
  })
  @IsOptional()
  @IsString()
  @Validate(CpfConstraint)
  cpf?: string;

  @ApiProperty({ description: 'ID do Médico Responsável' })
  @IsString()
  @IsNotEmpty()
  responsiblePhysicianId: string;
}
