import { IsNotEmpty, IsString } from 'class-validator';

export class PasswordResetVerifyDTO {
  @IsNotEmpty()
  @IsString()
  token: string;
}
