import { Injectable } from '@nestjs/common';
import { PreAuthPurpose, Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuthSessionRepository } from './auth-session.repository';
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

const sessionSelection = {
  id: true,
  userId: true,
  csrfTokenHash: true,
  authVersion: true,
  createdAt: true,
  expiresAt: true,
  lastInteractiveAt: true,
  mfaVerifiedAt: true,
  reauthenticatedAt: true,
  revokedAt: true,
  userAgent: true,
} satisfies Prisma.AuthSessionSelect;

const credentialSelection = {
  id: true,
  userId: true,
  label: true,
  secretCiphertext: true,
  secretIv: true,
  secretAuthTag: true,
  keyVersion: true,
  confirmedAt: true,
  lastUsedCounter: true,
} satisfies Prisma.MfaCredentialSelect;

/** Seleção pública do contexto: nunca inclui hash de senha ou segredo de MFA. */
const contextSelection = {
  id: true,
  email: true,
  type: true,
  isActive: true,
  isArchived: true,
  tokenVersion: true,
  professional: {
    select: {
      id: true,
      fullName: true,
      profession: true,
      organizationId: true,
      organization: { select: { isActive: true } },
      professionalRoles: {
        where: { revokedAt: null },
        select: { role: true },
      },
    },
  },
  patient: {
    select: {
      organizationId: true,
      organization: { select: { isActive: true } },
    },
  },
  mfaCredentials: {
    where: { revokedAt: null, confirmedAt: { not: null } },
    select: { id: true },
  },
} satisfies Prisma.UserSelect;

type ContextRow = Prisma.UserGetPayload<{ select: typeof contextSelection }>;

@Injectable()
export class PrismaAuthSessionRepository extends IAuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private toContext(user: ContextRow): AuthContext {
    const organizationId =
      user.professional?.organizationId ?? user.patient?.organizationId ?? null;
    const organizationIsActive =
      user.professional?.organization.isActive ??
      user.patient?.organization.isActive ??
      false;

    return {
      userId: user.id,
      email: user.email,
      type: user.type,
      isActive: user.isActive,
      isArchived: user.isArchived,
      authVersion: user.tokenVersion,
      organizationId,
      organizationIsActive,
      professionalId: user.professional?.id ?? null,
      profession: user.professional?.profession ?? null,
      fullName: user.professional?.fullName ?? null,
      roles: user.professional?.professionalRoles.map((r) => r.role) ?? [],
      hasConfirmedMfa: user.mfaCredentials.length > 0,
    };
  }

  async loadContextByUserId(userId: string): Promise<AuthContext | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: contextSelection,
    });
    return user ? this.toContext(user) : null;
  }

  async loadContextByEmail(email: string): Promise<AuthContext | null> {
    const users = await this.prisma.user.findMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      take: 2,
      select: contextSelection,
    });

    return users.length === 1 ? this.toContext(users[0]) : null;
  }

  /**
   * E-mail é comparado sem diferenciar maiúsculas: o usuário digita como
   * quiser. Quando o caso é o único diferencial entre duas contas, nenhuma é
   * escolhida — ambiguidade não autentica.
   */
  async findPasswordHashByEmail(
    email: string,
  ): Promise<{ userId: string; passwordHash: string } | null> {
    const users = await this.prisma.user.findMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      take: 2,
      select: { id: true, password: true },
    });

    if (users.length !== 1) return null;

    return { userId: users[0].id, passwordHash: users[0].password };
  }

  async findPasswordHashByUserId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    return user?.password ?? null;
  }

  async createSession(params: CreateSessionParams): Promise<StoredSession> {
    return this.prisma.authSession.create({
      data: {
        userId: params.userId,
        secretHash: params.secretHash,
        csrfTokenHash: params.csrfTokenHash,
        authVersion: params.authVersion,
        expiresAt: params.expiresAt,
        mfaVerifiedAt: params.mfaVerifiedAt,
        userAgent: params.userAgent,
        ipAddressHash: params.ipAddressHash,
      },
      select: sessionSelection,
    });
  }

  async findSessionBySecretHash(
    secretHash: string,
  ): Promise<SessionWithContext | null> {
    const found = await this.prisma.authSession.findUnique({
      where: { secretHash },
      select: { ...sessionSelection, user: { select: contextSelection } },
    });

    if (!found) return null;

    const { user, ...session } = found;
    return { session, context: this.toContext(user) };
  }

  async touchSession(sessionId: string, at: Date): Promise<void> {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { lastInteractiveAt: at },
    });
  }

  async rotateCsrfToken(
    sessionId: string,
    csrfTokenHash: string,
  ): Promise<void> {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { csrfTokenHash },
    });
  }

  async markReauthenticated(sessionId: string, at: Date): Promise<void> {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { reauthenticatedAt: at, lastInteractiveAt: at },
    });
  }

  async markMfaVerified(sessionId: string, at: Date): Promise<void> {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { mfaVerifiedAt: at },
    });
  }

  async revokeSession(
    sessionId: string,
    reason: SessionRevokeReason,
  ): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeSessionsForUser(
    userId: string,
    reason: SessionRevokeReason,
    exceptSessionId?: string,
  ): Promise<number> {
    const result = await this.prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }

  async listActiveSessions(userId: string): Promise<StoredSession[]> {
    return this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: [{ lastInteractiveAt: 'desc' }, { id: 'desc' }],
      select: sessionSelection,
    });
  }

  async findSessionForUser(
    sessionId: string,
    userId: string,
  ): Promise<StoredSession | null> {
    return this.prisma.authSession.findFirst({
      where: { id: sessionId, userId },
      select: sessionSelection,
    });
  }

  async createPreAuthChallenge(
    params: CreatePreAuthChallengeParams,
  ): Promise<StoredPreAuthChallenge> {
    return this.prisma.preAuthChallenge.create({
      data: {
        userId: params.userId,
        secretHash: params.secretHash,
        purpose: params.purpose,
        expiresAt: params.expiresAt,
        sessionId: params.sessionId ?? null,
        credentialId: params.credentialId ?? null,
      },
      select: {
        id: true,
        userId: true,
        purpose: true,
        sessionId: true,
        credentialId: true,
        attemptCount: true,
        expiresAt: true,
        consumedAt: true,
      },
    });
  }

  async findPreAuthChallenge(
    secretHash: string,
    purpose: PreAuthPurpose,
  ): Promise<StoredPreAuthChallenge | null> {
    return this.prisma.preAuthChallenge.findFirst({
      where: { secretHash, purpose },
      select: {
        id: true,
        userId: true,
        purpose: true,
        sessionId: true,
        credentialId: true,
        attemptCount: true,
        expiresAt: true,
        consumedAt: true,
      },
    });
  }

  async incrementPreAuthAttempt(challengeId: string): Promise<number> {
    const updated = await this.prisma.preAuthChallenge.update({
      where: { id: challengeId },
      data: { attemptCount: { increment: 1 } },
      select: { attemptCount: true },
    });
    return updated.attemptCount;
  }

  async consumePreAuthChallenge(challengeId: string): Promise<boolean> {
    const result = await this.prisma.preAuthChallenge.updateMany({
      where: { id: challengeId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return result.count === 1;
  }

  async listMfaCredentials(userId: string): Promise<StoredMfaCredential[]> {
    return this.prisma.mfaCredential.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'asc' },
      select: credentialSelection,
    });
  }

  async findMfaCredential(
    credentialId: string,
    userId: string,
  ): Promise<StoredMfaCredential | null> {
    return this.prisma.mfaCredential.findFirst({
      where: { id: credentialId, userId, revokedAt: null },
      select: credentialSelection,
    });
  }

  async createMfaCredential(params: {
    userId: string;
    label: string;
    secretCiphertext: string;
    secretIv: string;
    secretAuthTag: string;
    keyVersion: number;
  }): Promise<StoredMfaCredential> {
    return this.prisma.mfaCredential.create({
      data: params,
      select: credentialSelection,
    });
  }

  async confirmMfaCredential(credentialId: string, at: Date): Promise<void> {
    await this.prisma.mfaCredential.update({
      where: { id: credentialId },
      data: { confirmedAt: at },
    });
  }

  async registerMfaCredentialUse(
    credentialId: string,
    counter: bigint,
    at: Date,
  ): Promise<void> {
    await this.prisma.mfaCredential.update({
      where: { id: credentialId },
      data: { lastUsedCounter: counter, lastUsedAt: at },
    });
  }

  async revokeMfaCredential(credentialId: string, at: Date): Promise<void> {
    await this.prisma.mfaCredential.update({
      where: { id: credentialId },
      data: { revokedAt: at },
    });
  }

  async replaceRecoveryCodes(
    userId: string,
    codeHashes: string[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.mfaRecoveryCode.deleteMany({
        where: { userId, consumedAt: null },
      }),
      this.prisma.mfaRecoveryCode.createMany({
        data: codeHashes.map((codeHash) => ({ userId, codeHash })),
      }),
    ]);
  }

  async countAvailableRecoveryCodes(userId: string): Promise<number> {
    return this.prisma.mfaRecoveryCode.count({
      where: { userId, consumedAt: null },
    });
  }

  async consumeRecoveryCode(
    userId: string,
    codeHash: string,
  ): Promise<boolean> {
    const result = await this.prisma.mfaRecoveryCode.updateMany({
      where: { userId, codeHash, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return result.count === 1;
  }

  async recordAuthAttempt(params: {
    identifierHash: string;
    scope: string;
    operation: string;
    succeeded: boolean;
  }): Promise<void> {
    await this.prisma.authAttempt.create({ data: params });
  }

  async countFailedAttempts(
    identifierHash: string,
    operation: string,
    since: Date,
  ): Promise<number> {
    return this.prisma.authAttempt.count({
      where: {
        identifierHash,
        operation,
        succeeded: false,
        occurredAt: { gte: since },
      },
    });
  }
}
