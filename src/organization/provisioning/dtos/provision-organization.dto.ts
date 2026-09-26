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
import { IsPassword } from 'src/security/validation/password.validation';

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

  @ApiProperty({ description: 'Senha inicial do administrador' })
  @IsPassword()
  password: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  fullName: string;

  @ApiProperty({ description: 'Telefone comercial de contato' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phoneNumber: string;
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

  @ApiProperty()
  administrator: {
    userId: string;
    professionalId: string;
    email: string;
    roles: string[];
  };
}
