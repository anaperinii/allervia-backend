import {
  AuthSessionRevokeReason,
  PreAuthPurpose,
  Profession,
  Role,
  UserType,
} from '@prisma/client';

/** Contexto de autorização recarregado do banco a cada requisição. */
export interface AuthContext {
  userId: string;
  email: string;
  type: UserType;
  isActive: boolean;
  isArchived: boolean;
  authVersion: number;
  organizationId: string | null;
  organizationIsActive: boolean;
  professionalId: string | null;
  profession: Profession | null;
  fullName: string | null;
  roles: Role[];
  hasConfirmedMfa: boolean;
}

export interface SessionDeviceMetadata {
  userAgent: string | null;
  ipAddressHash: string | null;
}

export interface CreateSessionParams extends SessionDeviceMetadata {
  userId: string;
  secretHash: string;
  csrfTokenHash: string;
  authVersion: number;
  expiresAt: Date;
  mfaVerifiedAt: Date | null;
}

export interface StoredSession {
  id: string;
  userId: string;
  csrfTokenHash: string;
  authVersion: number;
  createdAt: Date;
  expiresAt: Date;
  lastInteractiveAt: Date;
  mfaVerifiedAt: Date | null;
  reauthenticatedAt: Date | null;
  revokedAt: Date | null;
  userAgent: string | null;
}

export interface SessionWithContext {
  session: StoredSession;
  context: AuthContext;
}

export interface CreatePreAuthChallengeParams {
  userId: string;
  secretHash: string;
  purpose: PreAuthPurpose;
  expiresAt: Date;
  sessionId?: string | null;
  credentialId?: string | null;
}

export interface StoredPreAuthChallenge {
  id: string;
  userId: string;
  purpose: PreAuthPurpose;
  sessionId: string | null;
  credentialId: string | null;
  attemptCount: number;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface StoredMfaCredential {
  id: string;
  userId: string;
  label: string;
  secretCiphertext: string;
  secretIv: string;
  secretAuthTag: string;
  keyVersion: number;
  confirmedAt: Date | null;
  lastUsedCounter: bigint | null;
}

export type SessionRevokeReason = AuthSessionRevokeReason;
