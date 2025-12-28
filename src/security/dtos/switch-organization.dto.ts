import { IsNotEmpty, IsString } from '@nestjs/class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SwitchOrganizationDto {
  @ApiProperty({ description: 'ID da organização' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;
}


