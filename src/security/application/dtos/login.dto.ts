import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
} from '@nestjs/class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({description: 'Email'})
  @IsEmail({ message: 'Forneça um email válido' })
  @IsNotEmpty({ message: 'O email não pode estar vazio' })
  email: string;

  @ApiProperty({description: 'Senha'})
  @IsString()
  @IsNotEmpty({ message: 'A senha não pode estar vazia' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  @MaxLength(8, { message: 'A senha deve ter no máximo 8 caracteres' })
  password: string;

  @ApiProperty({
    description: 'ID da organização ativa (opcional - apenas para PATIENT e SYSTEM_ADMIN com múltiplas organizações)',
    required: false
  })
  @IsOptional()
  @IsString()
  activeOrgId?: string
}

