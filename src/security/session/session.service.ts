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
  /** Valor do cookie; devolvido uma única vez, nunca relido do banco. */
  sessionSecret: string;
  /** Token CSRF sincronizador entregue à aplicação. */
  csrfToken: string;
}

/** Evita uma escrita por requisição só para atualizar a última interação. */
const TOUCH_THRESHOLD_MS = 60_000;

@Injectable()
export class SessionService {
  constructor(
    private readonly repository: IAuthSessionRepository,
    private readonly config: SessionConfig,
  ) {}

  async issue(
    context: AuthContext,
    device: SessionDeviceMetadata,
    mfaVerifiedAt: Date | null,
  ): Promise<IssuedSession> {
    const sessionSecret = generateOpaqueSecret();
    const csrfToken = generateOpaqueSecret();

    const session = await this.repository.createSession({
      userId: context.userId,
      secretHash: hashOpaqueSecret(sessionSecret),
      csrfTokenHash: hashOpaqueSecret(csrfToken),
      authVersion: context.authVersion,
      expiresAt: new Date(Date.now() + this.config.absoluteTimeoutMs),
      mfaVerifiedAt,
      userAgent: device.userAgent,
      ipAddressHash: device.ipAddressHash,
    });

    return { session, sessionSecret, csrfToken };
  }

  /**
   * Validação central de cada requisição: sessão viva, usuário e organização
   * ativos, versão de autorização e segundo fator conforme a política. Sem
   * cache: revogação tem efeito na requisição seguinte.
   */
  async validate(sessionSecret: string): Promise<SessionWithContext> {
    const found = await this.repository.findSessionBySecretHash(
      hashOpaqueSecret(sessionSecret),
    );

    if (!found) {
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.sessionExpired,
        AUTH_MESSAGES.sessionExpired,
      );
    }

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

    if (this.requiresSecondFactor(context) && !session.mfaVerifiedAt) {
      throw new CodedForbiddenException(
        AUTH_ERROR_CODES.mfaRequired,
        AUTH_MESSAGES.mfaRequired,
      );
    }

    return { session, context };
  }

  /**
   * Atividade real renova a inatividade, sempre dentro do teto absoluto.
   * Nenhum polling de notificação deve chamar isto.
   */
  async registerActivity(session: StoredSession): Promise<void> {
    const now = Date.now();
    if (now - session.lastInteractiveAt.getTime() < TOUCH_THRESHOLD_MS) return;
    await this.repository.touchSession(session.id, new Date(now));
  }

  validateCsrfToken(session: StoredSession, presented: string): boolean {
    if (!presented) return false;
    return safeEquals(session.csrfTokenHash, hashOpaqueSecret(presented));
  }

  /**
   * Um token CSRF novo é emitido junto do estado da sessão restaurada. O hash
   * antigo é substituído para que o token só valha enquanto a aplicação o tiver.
   */
  async rotateCsrfToken(sessionId: string): Promise<string> {
    const csrfToken = generateOpaqueSecret();
    await this.repository.rotateCsrfToken(
      sessionId,
      hashOpaqueSecret(csrfToken),
    );
    return csrfToken;
  }

  async revoke(
    sessionId: string,
    reason: AuthSessionRevokeReason,
  ): Promise<void> {
    await this.repository.revokeSession(sessionId, reason);
  }

  /** Sessões do próprio usuário; a lista já exclui expiradas e revogadas. */
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

  async markMfaVerified(sessionId: string): Promise<void> {
    await this.repository.markMfaVerified(sessionId, new Date());
  }

  /** Ações sensíveis exigem prova de identidade recente nesta sessão. */
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

  /**
   * Política: contas com vínculo profissional operam dados clínicos ou
   * administrativos e exigem segundo fator. Profissão sozinha não concede
   * acesso, mas qualquer conta profissional entra na política.
   */
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
