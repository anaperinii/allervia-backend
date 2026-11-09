import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class PasswordResetRequestDTO {
  @ApiProperty({ description: 'E-mail da conta', format: 'email' })
  @IsNotEmpty({ message: 'O email não pode estar vazio' })
  @IsEmail()
  email: string;
}
