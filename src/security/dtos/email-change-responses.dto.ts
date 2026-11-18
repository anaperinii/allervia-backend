import { ApiProperty } from '@nestjs/swagger';

export class EmailChangeVerifyResponseDto {
  @ApiProperty({ example: true })
  valid: boolean;

  @ApiProperty({ example: 'novo.endereco@clinica.com.br' })
  newEmail: string;
}

export class EmailChangeMessageResponseDto {
  @ApiProperty({ example: 'E-mail de acesso alterado com sucesso.' })
  message: string;
}
