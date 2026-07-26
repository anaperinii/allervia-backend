import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsPassword } from 'src/security/validation/password.validation';

export class LoginDto {
  @ApiProperty({ description: 'Email' })
  @IsEmail({}, { message: 'Forneça um email válido' })
  @IsNotEmpty({ message: 'O email não pode estar vazio' })
  email: string;

  @ApiProperty({ description: 'Senha' })
  @IsPassword()
  password: string;
}
