import { ApiProperty } from '@nestjs/swagger';

export class PasswordResetMessageResponseDto {
  @ApiProperty({
    example:
      'Se o e-mail existir, enviamos o link de redefinição para sua caixa de entrada.',
  })
  message: string;
}

export class PasswordResetVerifyResponseDto {
  @ApiProperty({ example: true })
  valid: boolean;
}
