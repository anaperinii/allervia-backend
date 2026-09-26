import { PreAuthPurpose } from '@prisma/client';
import {
  AuthContext,
  CreatePreAuthChallengeParams,
  CreateSessionParams,
  SessionRevokeReason,
  SessionWithContext,
  StoredMfaCredential,
  StoredPreAuthChallenge,
  StoredSession,
} from './session.types';

export abstract class IAuthSessionRepository {
  abstract loadContextByUserId(userId: string): Promise<AuthContext | null>;

  abstract loadContextByEmail(email: string): Promise<AuthContext | null>;

  abstract findPasswordHashByEmail(
    email: string,
  ): Promise<{ userId: string; passwordHash: string } | null>;

  abstract findPasswordHashByUserId(userId: string): Promise<string | null>;

  abstract createSession(params: CreateSessionParams): Promise<StoredSession>;

  abstract findSessionBySecretHash(
    secretHash: string,
  ): Promise<SessionWithContext | null>;

  abstract touchSession(sessionId: string, at: Date): Promise<void>;

  abstract rotateCsrfToken(
    sessionId: string,
    csrfTokenHash: string,
  ): Promise<void>;

  abstract markReauthenticated(sessionId: string, at: Date): Promise<void>;

  abstract markMfaVerified(sessionId: string, at: Date): Promise<void>;

  abstract revokeSession(
    sessionId: string,
    reason: SessionRevokeReason,
  ): Promise<void>;

  abstract revokeSessionsForUser(
    userId: string,
    reason: SessionRevokeReason,
    exceptSessionId?: string,
  ): Promise<number>;

  abstract listActiveSessions(userId: string): Promise<StoredSession[]>;

  abstract findSessionForUser(
    sessionId: string,
    userId: string,
  ): Promise<StoredSession | null>;

  abstract createPreAuthChallenge(
    params: CreatePreAuthChallengeParams,
  ): Promise<StoredPreAuthChallenge>;

  abstract findPreAuthChallenge(
    secretHash: string,
    purpose: PreAuthPurpose,
  ): Promise<StoredPreAuthChallenge | null>;

  abstract incrementPreAuthAttempt(challengeId: string): Promise<number>;

  abstract consumePreAuthChallenge(challengeId: string): Promise<boolean>;

  abstract listMfaCredentials(userId: string): Promise<StoredMfaCredential[]>;

  abstract findMfaCredential(
    credentialId: string,
    userId: string,
  ): Promise<StoredMfaCredential | null>;

  abstract createMfaCredential(params: {
    userId: string;
    label: string;
    secretCiphertext: string;
    secretIv: string;
    secretAuthTag: string;
    keyVersion: number;
  }): Promise<StoredMfaCredential>;

  abstract confirmMfaCredential(credentialId: string, at: Date): Promise<void>;

  abstract registerMfaCredentialUse(
    credentialId: string,
    counter: bigint,
    at: Date,
  ): Promise<void>;

  abstract revokeMfaCredential(credentialId: string, at: Date): Promise<void>;

  abstract replaceRecoveryCodes(
    userId: string,
    codeHashes: string[],
  ): Promise<void>;

  abstract countAvailableRecoveryCodes(userId: string): Promise<number>;

  abstract consumeRecoveryCode(
    userId: string,
    codeHash: string,
  ): Promise<boolean>;

  abstract recordAuthAttempt(params: {
    identifierHash: string;
    scope: string;
    operation: string;
    succeeded: boolean;
  }): Promise<void>;

  abstract countFailedAttempts(
    identifierHash: string,
    operation: string,
    since: Date,
  ): Promise<number>;
}
