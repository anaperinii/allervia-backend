import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordResponseDto {
  @ApiProperty({ example: 'Senha alterada com sucesso.' })
  message: string;
}
