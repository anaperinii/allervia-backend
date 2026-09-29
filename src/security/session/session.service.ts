import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/infra/database/prisma.service';
import { Injectable } from '@nestjs/common';
import { AuthSessionRevokeReason } from '@prisma/client';
import {
  CodedForbiddenException,
  CodedUnauthorizedException,
} from 'src/infra/exceptions/coded.exception';
import { AUTH_ERROR_CODES, AUTH_MESSAGES } from '../auth.messages';
import { IAuthSessionRepository } from './auth-session.repository';
import { SessionConfig } from './session.config';
import {
  generateOpaqueSecret,
  hashOpaqueSecret,
  safeEquals,
} from './session.crypto';
import {
  AuthContext,
  SessionDeviceMetadata,
  SessionWithContext,
  StoredSession,
} from './session.types';

export interface IssuedSession {
  session: StoredSession;
  sessionSecret: string;
  csrfToken: string;
}

const TOUCH_THRESHOLD_MS = 60_000;

@Injectable()
export class SessionService {
  constructor(
    private readonly repository: IAuthSessionRepository,
    private readonly config: SessionConfig,
    private readonly prisma: PrismaService,
    private readonly environment: ConfigService,
  ) {
    if (
      Buffer.byteLength(
        this.environment.get<string>('AUTH_SESSION_CSRF_SECRET') ?? '',
      ) < 32
    )
      throw new Error('AUTH_SESSION_CSRF_SECRET requires at least 32 bytes');
  }

  async issue(
    context: AuthContext,
    device: SessionDeviceMetadata,
    mfaVerifiedAt: Date | null,
  ): Promise<IssuedSession> {
    await this.assertAccountUsable(context);
    const sessionSecret = generateOpaqueSecret();

    const session = await this.repository.createSession({
      userId: context.userId,
      organizationId: context.organizationId!,
      secretHash: hashOpaqueSecret(sessionSecret),
      authVersion: context.authVersion,
      expiresAt: new Date(Date.now() + this.config.absoluteTimeoutMs),
      mfaVerifiedAt,
      userAgent: device.userAgent,
      ipAddressHash: device.ipAddressHash,
    });

    return {
      session,
      sessionSecret,
      csrfToken: this.csrfForSession(session.id),
    };
  }

  async validate(secret: string): Promise<SessionWithContext> {
    const found = await this.findBySecret(secret);
    if (!found)
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.sessionExpired,
        AUTH_MESSAGES.sessionExpired,
      );
    const { session, context } = found;
    const now = Date.now();

    if (session.revokedAt) {
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.sessionRevoked,
        AUTH_MESSAGES.sessionRevoked,
      );
    }

    if (session.expiresAt.getTime() <= now) {
      await this.repository.revokeSession(
        session.id,
        AuthSessionRevokeReason.ABSOLUTE_TIMEOUT,
      );
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.sessionExpired,
        AUTH_MESSAGES.sessionExpired,
      );
    }

    if (
      now - session.lastInteractiveAt.getTime() >=
      this.config.idleTimeoutMs
    ) {
      await this.repository.revokeSession(
        session.id,
        AuthSessionRevokeReason.IDLE_TIMEOUT,
      );
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.sessionExpired,
        AUTH_MESSAGES.sessionIdle,
      );
    }

    if (session.authVersion !== context.authVersion) {
      await this.repository.revokeSession(
        session.id,
        AuthSessionRevokeReason.PASSWORD_CHANGED,
      );
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.sessionRevoked,
        AUTH_MESSAGES.sessionRevoked,
      );
    }

    await this.assertAccountUsable(context, session.id);
    if (session.organizationId !== context.organizationId)
      throw new CodedUnauthorizedException(
        'SESSION_CONTEXT_CHANGED',
        'Entre novamente.',
      );

    if (this.requiresSecondFactor(context) && !session.mfaVerifiedAt) {
      throw new CodedForbiddenException(
        AUTH_ERROR_CODES.mfaRequired,
        AUTH_MESSAGES.mfaRequired,
      );
    }

    return { session, context };
  }

  async registerActivity(session: StoredSession): Promise<void> {
    const now = Date.now();
    if (now - session.lastInteractiveAt.getTime() < TOUCH_THRESHOLD_MS) return;
    const updated = await this.prisma.authSession.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        expiresAt: { gt: new Date(now) },
        lastInteractiveAt: { gt: new Date(now - this.config.idleTimeoutMs) },
      },
      data: { lastInteractiveAt: new Date(now) },
    });
    if (!updated.count)
      throw new CodedUnauthorizedException(
        'SESSION_EXPIRED',
        'Entre novamente.',
      );
  }

  csrfForSession(id: string): string {
    return createHmac(
      'sha256',
      this.environment.getOrThrow<string>('AUTH_SESSION_CSRF_SECRET'),
    )
      .update('session-csrf:v2:' + id)
      .digest('base64url');
  }

  async findBySecret(secret: string): Promise<SessionWithContext | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) return null;
    return this.repository.findSessionByHash(hashOpaqueSecret(secret));
  }

  assertCsrf(session: StoredSession, presented?: string): void {
    if (!presented || !safeEquals(this.csrfForSession(session.id), presented))
      throw new CodedForbiddenException(
        'CSRF_TOKEN_INVALID',
        'Token de proteção inválido.',
      );
  }

  async revoke(
    sessionId: string,
    reason: AuthSessionRevokeReason,
  ): Promise<void> {
    await this.repository.revokeSession(sessionId, reason);
  }

  async listDevices(userId: string): Promise<StoredSession[]> {
    const sessions = await this.repository.listActiveSessions(userId);
    const idleLimit = Date.now() - this.config.idleTimeoutMs;
    return sessions.filter(
      (session) => session.lastInteractiveAt.getTime() > idleLimit,
    );
  }

  async findDeviceForUser(
    sessionId: string,
    userId: string,
  ): Promise<StoredSession | null> {
    return this.repository.findSessionForUser(sessionId, userId);
  }

  async replaceCredential(session: StoredSession): Promise<string> {
    const secret = generateOpaqueSecret();
    const updated = await this.prisma.authSession.updateMany({
      where: { id: session.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { secretHash: hashOpaqueSecret(secret), mfaVerifiedAt: new Date() },
    });
    if (!updated.count)
      throw new CodedUnauthorizedException(
        'SESSION_REVOKED',
        'Entre novamente.',
      );
    return secret;
  }

  assertRecentReauthentication(session: StoredSession): void {
    const at = session.reauthenticatedAt?.getTime();
    if (
      at !== undefined &&
      Date.now() - at <= this.config.reauthenticationMaxAgeMs
    ) {
      return;
    }

    throw new CodedForbiddenException(
      AUTH_ERROR_CODES.reauthenticationRequired,
      AUTH_MESSAGES.reauthenticationRequired,
    );
  }

  async revokeAllForUser(
    userId: string,
    reason: AuthSessionRevokeReason,
    exceptSessionId?: string,
  ): Promise<number> {
    return this.repository.revokeSessionsForUser(
      userId,
      reason,
      exceptSessionId,
    );
  }

  requiresSecondFactor(context: AuthContext): boolean {
    if (this.config.mfaEnforcement === 'optional') {
      return context.hasConfirmedMfa;
    }
    return context.hasConfirmedMfa || context.professionalId !== null;
  }

  async assertAccountUsable(
    context: AuthContext,
    sessionId?: string,
  ): Promise<void> {
    const accountUnusable = !context.isActive || context.isArchived;
    const organizationUnusable =
      !context.organizationId || !context.organizationIsActive;

    if (!accountUnusable && !organizationUnusable) return;

    if (sessionId) {
      await this.repository.revokeSession(
        sessionId,
        AuthSessionRevokeReason.ACCOUNT_DISABLED,
      );
    }

    throw accountUnusable
      ? new CodedUnauthorizedException(
          AUTH_ERROR_CODES.accountDisabled,
          AUTH_MESSAGES.accountDisabled,
        )
      : new CodedUnauthorizedException(
          AUTH_ERROR_CODES.organizationDisabled,
          AUTH_MESSAGES.organizationDisabled,
        );
  }
}
