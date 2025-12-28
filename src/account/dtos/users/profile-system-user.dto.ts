import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from "@nestjs/class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ProfileSystemUserDto {
  
  @ApiProperty({description: 'Nome Completo'})
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({description: 'E-mail'})
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({description: 'Senha'})
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres.' })
  @MaxLength(8, { message: 'A senha deve ter no máximo 8 caracteres' })
  password: string;

  @ApiProperty({ description: 'Key para register'})
  @IsString()
  @IsNotEmpty()
  key: string;
}