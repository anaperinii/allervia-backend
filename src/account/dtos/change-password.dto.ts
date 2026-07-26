import { IsNotEmpty, IsString } from 'class-validator';
import { IsPassword } from 'src/security/validation/password.validation';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsPassword()
  newPassword: string;
}
