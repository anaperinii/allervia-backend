import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  Max,
  Matches,
} from 'class-validator';
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

export const MAX_PATIENT_AGE_YEARS = 130;

@ValidatorConstraint({ name: 'birthDate', async: false })
export class BirthDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const birth = new Date(value);
    if (!Number.isFinite(birth.getTime())) return false;

    const now = new Date();
    if (birth.getTime() > now.getTime()) return false;

    const oldest = new Date(now);
    oldest.setFullYear(oldest.getFullYear() - MAX_PATIENT_AGE_YEARS);
    return birth.getTime() >= oldest.getTime();
  }

  defaultMessage(): string {
    return `Data de nascimento inválida: não pode ser futura nem anterior a ${MAX_PATIENT_AGE_YEARS} anos atrás.`;
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

  @ApiProperty({
    description: 'Telefone do responsável (DDD + número, somente dígitos)',
    pattern: '^\\d{11}$',
    minLength: 11,
    maxLength: 11,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, {
    message:
      'Número de telefone inválido. Deve conter 11 dígitos (DDD + número).',
  })
  phoneNumber: string;
}

export class CreatePatientDto {
  @ApiProperty({ description: 'Nome completo' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    description:
      'Data de nascimento. Não pode ser futura nem anterior a 130 anos.',
  })
  @IsDateString({ strict: true })
  @IsNotEmpty()
  @Validate(BirthDateConstraint)
  birthDate: string;

  @ApiProperty({ description: 'Peso em kg' })
  @IsNumber()
  @Min(0.1, { message: 'Peso deve ser maior que zero' })
  @Max(500, { message: 'Peso inválido. Valor muito alto.' })
  weightInKg: number;

  @ApiProperty({
    description: 'Número de telefone (DDD + número, somente dígitos)',
    pattern: '^\\d{11}$',
    minLength: 11,
    maxLength: 11,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, {
    message:
      'Número de telefone inválido. Deve conter 11 dígitos (DDD + número).',
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
