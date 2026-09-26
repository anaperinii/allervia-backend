import { Injectable } from '@nestjs/common';
import { CodedUnauthorizedException } from 'src/infra/exceptions/coded.exception';
import { IPasswordHashingService } from 'src/security/interfaces/password-hashing.service.interface';
import { AUTH_ERROR_CODES, AUTH_MESSAGES } from 'src/security/auth.messages';
import { IAuthSessionRepository } from '../auth-session.repository';
import {
  AUTH_OPERATIONS,
  AuthRateLimitService,
} from '../auth-rate-limit.service';
import { MfaService } from '../mfa.service';
import { AuthContext, StoredSession } from '../session.types';

export interface ReauthenticateInput {
  session: StoredSession;
  context: AuthContext;
  password: string;
  code?: string;
}

@Injectable()
export class ReauthenticateUseCase {
  constructor(
    private readonly repository: IAuthSessionRepository,
    private readonly passwordHashing: IPasswordHashingService,
    private readonly mfaService: MfaService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  async execute(input: ReauthenticateInput): Promise<Date> {
    await this.rateLimit.assertWithinLimit(
      input.context.userId,
      'account',
      AUTH_OPERATIONS.reauthenticate,
    );

    const passwordHash = await this.repository.findPasswordHashByUserId(
      input.context.userId,
    );

    const valid =
      passwordHash !== null &&
      (await this.passwordHashing.compare(input.password, passwordHash));

    if (!valid) {
      await this.rateLimit.record(
        input.context.userId,
        'account',
        AUTH_OPERATIONS.reauthenticate,
        false,
      );
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.invalidCredentials,
        AUTH_MESSAGES.invalidCredentials,
      );
    }

    if (input.context.hasConfirmedMfa) {
      const accepted =
        input.code !== undefined &&
        (await this.mfaService.verifyCode(input.context.userId, input.code));

      if (!accepted) {
        await this.rateLimit.record(
          input.context.userId,
          'account',
          AUTH_OPERATIONS.reauthenticate,
          false,
        );
        throw new CodedUnauthorizedException(
          AUTH_ERROR_CODES.mfaCodeInvalid,
          AUTH_MESSAGES.mfaCodeInvalid,
        );
      }
    }

    const at = new Date();
    await this.repository.markReauthenticated(input.session.id, at);
    await this.rateLimit.record(
      input.context.userId,
      'account',
      AUTH_OPERATIONS.reauthenticate,
      true,
    );

    return at;
  }
}
