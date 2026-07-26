import { IsEmail, IsNotEmpty } from 'class-validator';

export class PasswordResetRequestDTO {
  @IsNotEmpty({ message: 'O email não pode estar vazio' })
  @IsEmail()
  email: string;
}
