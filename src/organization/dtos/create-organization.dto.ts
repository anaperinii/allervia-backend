import { IsNotEmpty, IsString } from '@nestjs/class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ description: 'Nome da organização' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'CNPJ da organização' })
  @IsString()
  @IsNotEmpty()
  taxId!: string;
}
