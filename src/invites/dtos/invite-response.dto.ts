import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export const INVITE_STATUS = {
  active: 'ACTIVE',
  expired: 'EXPIRED',
  used: 'USED',
  cancelled: 'CANCELLED',
} as const;

export type InviteStatus = (typeof INVITE_STATUS)[keyof typeof INVITE_STATUS];

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

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty({ nullable: true })
  usedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Quem emitiu o convite' })
  createdBy?: { id: string; email: string };
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
