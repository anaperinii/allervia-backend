import { Role } from '@prisma/client';
import { UserInviteExpiredException } from 'src/invites/domain/exceptions/user-invite-expired.exception';
import { UserInviteAlreadyUsedException } from 'src/invites/domain/exceptions/user-invite-already-used.exception';
import { UserInviteCancelledException } from 'src/invites/domain/exceptions/user-invite-cancelled.exception';

interface UserInviteProps {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  organizationId: string;
  professionalId: string | null;
  createdById: string;
  token: string;
  expiresAt: Date;
  isActive: boolean;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateUserInviteProps {
  email: string;
  fullName: string;
  role: Role;
  organizationId: string;
  createdById: string;
  token: string;
  expiresAt: Date;
}

export class UserInvite {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  organizationId: string;
  professionalId: string | null;
  createdById: string;
  token: string;
  expiresAt: Date;
  isActive: boolean;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: UserInviteProps) {
    this.id = props.id,
    this.email = props.email,
    this.fullName = props.fullName,
    this.role = props.role,
    this.organizationId = props.organizationId,
    this.professionalId = props.professionalId,
    this.createdById = props.createdById,
    this.token = props.token,
    this.expiresAt = props.expiresAt,
    this.isActive = props.isActive,
    this.usedAt = props.usedAt,
    this.createdAt = props.createdAt,
    this.updatedAt = props.updatedAt
  }

  static createNew(props: CreateUserInviteProps) {
    return {
      email: props.email,
      fullName: props.fullName,
      role: props.role,
      organizationId: props.organizationId,
      createdById: props.createdById,
      token: props.token,
      expiresAt: props.expiresAt,
      isActive: true
    }
  }

  markAsUsed(): void {
    this.validateForUse();
    this.isActive = false;
    this.usedAt = new Date();
  }

  includeProfessional(professionalId: string): void {
    this.professionalId = professionalId
  }
 
  deactive(): void {
    this.isActive = false;
  }

  validateForUse(): void {
    if (this.isUsed()) {
      throw new UserInviteAlreadyUsedException();
    }

    if (this.isExpired()) {
      throw new UserInviteExpiredException();
    }

    if (this.isDeactive()) {
      throw new UserInviteCancelledException();
    }
  }

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  isUsed(): boolean {
    return !this.isActive || this.usedAt !== null;
  }

  isDeactive(): boolean {
    return this.isActive === false && this.usedAt === null;
  }
}

