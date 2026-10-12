import { ApiProperty } from '@nestjs/swagger';

export class OrganizationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'CNPJ, apenas dígitos' })
  taxId: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ description: 'Fuso clínico adotado por novas prescrições' })
  timeZone: string;

  @ApiProperty({ description: 'Automação de protocolo habilitada' })
  automationEnabled: boolean;

  @ApiProperty({
    description: 'Revisão para lock otimista das configurações organizacionais',
  })
  revision: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
