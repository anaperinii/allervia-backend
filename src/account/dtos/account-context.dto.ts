import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Profession, Role, UserType } from '@prisma/client';

export class AccountUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: UserType })
  type: UserType;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class AccountProfessionalDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty({ enum: Profession })
  profession: Profession;

  @ApiProperty({ nullable: true })
  councilNumber: string | null;

  @ApiProperty({ nullable: true })
  councilUf: string | null;
}

export class AccountOrganizationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'Fuso clínico da organização (IANA).' })
  timeZone: string;

  @ApiProperty({ description: 'Automação de protocolo habilitada.' })
  automationEnabled: boolean;
}

export class AccountSecurityDto {
  @ApiProperty({ description: 'Existe segundo fator confirmado.' })
  mfaEnabled: boolean;

  @ApiProperty({
    description: 'A política exige segundo fator para esta conta.',
  })
  mfaRequired: boolean;

  @ApiProperty({ description: 'A requisição atual usa sessão do navegador.' })
  sessionBased: boolean;
}

export class AccountContextDto {
  @ApiProperty({ type: AccountUserDto })
  user: AccountUserDto;

  @ApiPropertyOptional({ type: AccountProfessionalDto, nullable: true })
  professional: AccountProfessionalDto | null;

  @ApiPropertyOptional({ type: AccountOrganizationDto, nullable: true })
  organization: AccountOrganizationDto | null;

  @ApiProperty({ enum: Role, isArray: true })
  roles: Role[];

  @ApiProperty({
    type: [String],
    description:
      'Capacidades gerais. Cada comando é reavaliado no servidor por objeto.',
  })
  capabilities: string[];

  @ApiProperty({ type: AccountSecurityDto })
  security: AccountSecurityDto;
}
