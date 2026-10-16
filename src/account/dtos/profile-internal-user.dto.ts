import { ApiProperty } from '@nestjs/swagger';
import { Profession } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { IsPassword } from 'src/security/validation/password.validation';

export class ProfileInternalUserDto {
  @ApiProperty({ description: 'Nome Completo' })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({ description: 'Senha' })
  @IsPassword()
  password: string;

  @ApiProperty({ description: 'Profissão', enum: Profession })
  @IsEnum(Profession, { message: 'Profissão inválida' })
  profession: Profession;

  @ApiProperty({ description: 'Telefone Comercial de Contato' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}
