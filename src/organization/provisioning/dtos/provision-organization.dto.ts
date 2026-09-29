import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
export class ProvisionOrganizationOrganizationDto {
  @ApiProperty({ description: 'Nome da organização' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name: string;

  @ApiProperty({ description: 'CNPJ, apenas dígitos' })
  @IsString()
  @Length(14, 14)
  taxId: string;
}

export class ProvisionOrganizationAdministratorDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  fullName: string;
}

export class ProvisionOrganizationDto {
  @ApiProperty({ type: ProvisionOrganizationOrganizationDto })
  @IsObject()
  @ValidateNested()
  @Type(() => ProvisionOrganizationOrganizationDto)
  organization: ProvisionOrganizationOrganizationDto;

  @ApiProperty({ type: ProvisionOrganizationAdministratorDto })
  @IsObject()
  @ValidateNested()
  @Type(() => ProvisionOrganizationAdministratorDto)
  administrator: ProvisionOrganizationAdministratorDto;
}

export class ProvisionedOrganizationDto {
  @ApiProperty()
  organization: { id: string; name: string; taxId: string };

  @ApiProperty({
    description:
      'Convite de administrador emitido; a senha é definida pelo próprio convidado ao concluir o registro.',
  })
  administratorInvite: {
    id: string;
    email: string;
    role: string;
    expiresAt: Date;
  };
}
