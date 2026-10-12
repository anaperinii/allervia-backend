import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
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

export class ProvisionedOrganizationSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  taxId: string;
}

export class ProvisionedAdministratorInviteDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ format: 'date-time' })
  expiresAt: Date;
}

export class ProvisionedOrganizationDto {
  @ApiProperty({ type: ProvisionedOrganizationSummaryDto })
  organization: ProvisionedOrganizationSummaryDto;

  @ApiProperty({
    type: ProvisionedAdministratorInviteDto,
    description:
      'Convite de administrador emitido; a senha é definida pelo próprio convidado ao concluir o registro.',
  })
  administratorInvite: ProvisionedAdministratorInviteDto;

  @ApiProperty({
    description:
      'Indica se o e-mail do convite foi entregue ao provedor. Quando false, a organização e o convite foram criados mesmo assim; use a rota de reenvio de convite.',
  })
  inviteEmailDelivered: boolean;
}

export class ResendAdministratorInviteResponseDto {
  @ApiProperty({ type: ProvisionedAdministratorInviteDto })
  administratorInvite: ProvisionedAdministratorInviteDto;

  @ApiProperty({
    description:
      'Indica se o e-mail do convite foi entregue ao provedor nesta tentativa.',
  })
  inviteEmailDelivered: boolean;

  @ApiProperty({
    description:
      'true quando o convite anterior estava expirado e um novo convite foi emitido no lugar.',
  })
  reissued: boolean;
}
