import { IsNotEmpty, IsString } from 'class-validator';
import { IsPassword } from 'src/security/validation/password.validation';

export class PasswordResetConfirmDTO {
  @IsNotEmpty()
  @IsString()
  token: string;

  @IsPassword()
  newPassword: string;
}
