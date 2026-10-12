import { ApiProperty } from '@nestjs/swagger';

export class PasswordResetMessageResponseDto {
  @ApiProperty({
    example: 'Se o e-mail existir, enviamos as instruções de redefinição.',
  })
  message: string;
}

export class PasswordResetVerifyResponseDto {
  @ApiProperty({ example: true })
  valid: boolean;
}
