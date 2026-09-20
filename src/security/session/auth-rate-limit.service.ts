import { Injectable } from '@nestjs/common';
import { CodedTooManyRequestsException } from 'src/infra/exceptions/coded.exception';
import { AUTH_ERROR_CODES, AUTH_MESSAGES } from '../auth.messages';
import { IAuthSessionRepository } from './auth-session.repository';
import { SessionConfig } from './session.config';
import { hashIdentifier } from './session.crypto';

export const AUTH_OPERATIONS = {
  login: 'login',
  mfaVerify: 'mfa-verify',
  reauthenticate: 'reauthenticate',
} as const;

export type AuthOperation =
  (typeof AUTH_OPERATIONS)[keyof typeof AUTH_OPERATIONS];

/**
 * Limite de tentativas por conta e por IP, guardado no PostgreSQL para valer em
 * todas as instâncias. Uma resposta de limite não revela se a conta existe.
 */
@Injectable()
export class AuthRateLimitService {
  constructor(
    private readonly repository: IAuthSessionRepository,
    private readonly config: SessionConfig,
  ) {}

  async assertWithinLimit(
    identifier: string,
    scope: 'account' | 'ip',
    operation: AuthOperation,
  ): Promise<void> {
    const since = new Date(Date.now() - this.config.loginAttemptWindowMs);
    const failures = await this.repository.countFailedAttempts(
      hashIdentifier(`${scope}:${identifier}`),
      operation,
      since,
    );

    if (failures >= this.config.maxLoginAttempts) {
      throw new CodedTooManyRequestsException(
        AUTH_ERROR_CODES.tooManyAttempts,
        AUTH_MESSAGES.tooManyAttempts,
      );
    }
  }

  async record(
    identifier: string,
    scope: 'account' | 'ip',
    operation: AuthOperation,
    succeeded: boolean,
  ): Promise<void> {
    await this.repository.recordAuthAttempt({
      identifierHash: hashIdentifier(`${scope}:${identifier}`),
      scope,
      operation,
      succeeded,
    });
  }
}
