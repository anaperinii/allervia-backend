import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export const INVITE_STATUS = {
  active: 'ACTIVE',
  expired: 'EXPIRED',
  used: 'USED',
  cancelled: 'CANCELLED',
} as const;

export type InviteStatus = (typeof INVITE_STATUS)[keyof typeof INVITE_STATUS];

export class InviteCreatedByDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;
}

export class InviteResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ enum: Object.values(INVITE_STATUS) })
  status: InviteStatus;

  @ApiProperty({ format: 'date-time' })
  expiresAt: Date;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  usedAt: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiPropertyOptional({
    type: InviteCreatedByDto,
    description: 'Quem emitiu o convite',
  })
  createdBy?: InviteCreatedByDto;

  @ApiPropertyOptional({
    description:
      'Presente ao criar/reenviar: false indica que o e-mail não foi aceito pelo provedor e o convite deve ser reenviado (o convite em si está persistido).',
  })
  emailDelivered?: boolean;

  @ApiPropertyOptional({
    description:
      'Presente no reenvio: true quando o convite expirado foi cancelado e reemitido com novo token.',
  })
  reissued?: boolean;
}

export class InvitePageDto {
  @ApiProperty({ type: [InviteResponseDto] })
  items: InviteResponseDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty({ description: 'Total de registros no escopo da consulta' })
  total: number;
}

export class InviteContextDto {
  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty()
  organizationName: string;

  @ApiProperty()
  expiresAt: Date;
}

export function resolveInviteStatus(invite: {
  isActive: boolean;
  usedAt: Date | null;
  expiresAt: Date;
}): InviteStatus {
  if (invite.usedAt) return INVITE_STATUS.used;
  if (!invite.isActive) return INVITE_STATUS.cancelled;
  if (invite.expiresAt.getTime() <= Date.now()) return INVITE_STATUS.expired;
  return INVITE_STATUS.active;
}
