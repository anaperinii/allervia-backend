import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ description: 'Nome Completo' })
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @ApiProperty({ description: 'E-mail' })
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @ApiProperty({ description: 'Senha' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres.' })
  @MaxLength(8, { message: 'A senha deve ter no máximo 8 caracteres' })
  password?: string;

  @ApiProperty({ description: 'Especialidade/Atuação' })
  @IsString()
  @IsOptional()
  specialty?: string;

  @ApiProperty({ description: 'Telefone Comercial de Contato' })
  @IsString()
  @IsOptional()
  phoneNumber?: string;
}
