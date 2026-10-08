import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  Max,
  Matches,
} from '@nestjs/class-validator';
import { IsOptional, Validate, ValidateNested } from 'class-validator';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
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

export class GuardianDto {
  @ApiProperty({ description: 'Nome completo do responsável legal' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional({
    description:
      'CPF do responsável, com ou sem máscara. Ausente quando a pessoa não possui CPF conhecido.',
  })
  @IsOptional()
  @IsString()
  @Validate(CpfConstraint)
  cpf?: string;

  @ApiProperty({ description: 'Telefone do responsável' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10,11}$/, {
    message: 'Número de telefone inválido. Deve conter 10 ou 11 dígitos.',
  })
  phoneNumber: string;
}

export class CreatePatientDto {
  @ApiProperty({ description: 'Nome completo' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ description: 'Data de Nascimento' })
  @IsDateString({ strict: true })
  @IsNotEmpty()
  birthDate: string;

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

  @ApiPropertyOptional({
    description:
      'Responsável legal. Obrigatório para menores de 18 anos e recusado para maiores. Enviar null remove o vínculo.',
    type: GuardianDto,
    nullable: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GuardianDto)
  guardian?: GuardianDto | null;
}
