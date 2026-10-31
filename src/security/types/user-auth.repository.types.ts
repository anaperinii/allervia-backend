import { VerificationPurpose } from '@prisma/client';

export interface UserForAuth {
  id: string;
  email: string;
  password: string;
  type: string;
  organizationId: string | null;
  professionalId: string | null;
  roles: string[];
  tokenVersion: number;
}

export interface CreateVerificationTokenParams {
  userId: string;
  purpose: VerificationPurpose;
  tokenHash: string;
  newEmail?: string | null;
  expiresAt: Date;
  requestedById?: string | null;
  approvedAt?: Date | null;
  approvedById?: string | null;
}

export interface ActiveVerificationToken {
  id: string;
  userId: string;
  userEmail: string;
  userPassword: string;
  newEmail: string | null;
  approvedAt: Date | null;
  expiresAt: Date;
}
