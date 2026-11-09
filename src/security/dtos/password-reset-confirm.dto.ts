import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsPassword } from 'src/security/validation/password.validation';

export class PasswordResetConfirmDTO {
  @ApiProperty({ description: 'Token de redefinição de senha' })
  @IsNotEmpty()
  @IsString()
  token: string;

  @IsPassword()
  newPassword: string;
}
