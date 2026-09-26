import { Injectable } from '@nestjs/common';
import { PreAuthPurpose } from '@prisma/client';
import { CodedUnauthorizedException } from 'src/infra/exceptions/coded.exception';
import { AUTH_ERROR_CODES, AUTH_MESSAGES } from 'src/security/auth.messages';
import { IAuthSessionRepository } from '../auth-session.repository';
import {
  AUTH_OPERATIONS,
  AuthRateLimitService,
} from '../auth-rate-limit.service';
import { MfaService } from '../mfa.service';
import { SessionConfig } from '../session.config';
import { hashOpaqueSecret } from '../session.crypto';
import { IssuedSession, SessionService } from '../session.service';
import { AuthContext, SessionDeviceMetadata } from '../session.types';

export interface VerifyMfaInput {
  challengeToken: string;
  code: string;
  device: SessionDeviceMetadata;
}

export interface VerifyMfaResult {
  issued: IssuedSession;
  context: AuthContext;
  recoveryCodes?: string[];
}

@Injectable()
export class VerifyMfaChallengeUseCase {
  constructor(
    private readonly repository: IAuthSessionRepository,
    private readonly mfaService: MfaService,
    private readonly sessionService: SessionService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly config: SessionConfig,
  ) {}

  async execute(input: VerifyMfaInput): Promise<VerifyMfaResult> {
    const secretHash = hashOpaqueSecret(input.challengeToken);

    const challenge =
      (await this.repository.findPreAuthChallenge(
        secretHash,
        PreAuthPurpose.MFA_CHALLENGE,
      )) ??
      (await this.repository.findPreAuthChallenge(
        secretHash,
        PreAuthPurpose.MFA_ENROLLMENT,
      ));

    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt.getTime() <= Date.now()
    ) {
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.mfaChallengeInvalid,
        AUTH_MESSAGES.mfaChallengeInvalid,
      );
    }

    await this.rateLimit.assertWithinLimit(
      challenge.userId,
      'account',
      AUTH_OPERATIONS.mfaVerify,
    );

    const attempts = await this.repository.incrementPreAuthAttempt(
      challenge.id,
    );
    if (attempts > this.config.maxChallengeAttempts) {
      await this.repository.consumePreAuthChallenge(challenge.id);
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.mfaChallengeInvalid,
        AUTH_MESSAGES.mfaChallengeInvalid,
      );
    }

    const isEnrollment = challenge.purpose === PreAuthPurpose.MFA_ENROLLMENT;
    let recoveryCodes: string[] | undefined;

    if (isEnrollment) {
      if (!challenge.credentialId) {
        throw new CodedUnauthorizedException(
          AUTH_ERROR_CODES.mfaChallengeInvalid,
          AUTH_MESSAGES.mfaChallengeInvalid,
        );
      }
      const confirmation = await this.mfaService.confirmEnrollment(
        challenge.userId,
        challenge.credentialId,
        input.code,
      );
      recoveryCodes = confirmation.recoveryCodes;
    } else {
      const accepted = await this.mfaService.verifyCode(
        challenge.userId,
        input.code,
      );

      if (!accepted) {
        await this.rateLimit.record(
          challenge.userId,
          'account',
          AUTH_OPERATIONS.mfaVerify,
          false,
        );
        throw new CodedUnauthorizedException(
          AUTH_ERROR_CODES.mfaCodeInvalid,
          AUTH_MESSAGES.mfaCodeInvalid,
        );
      }
    }

    if (!(await this.repository.consumePreAuthChallenge(challenge.id))) {
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.mfaChallengeInvalid,
        AUTH_MESSAGES.mfaChallengeInvalid,
      );
    }

    await this.rateLimit.record(
      challenge.userId,
      'account',
      AUTH_OPERATIONS.mfaVerify,
      true,
    );

    const context = await this.repository.loadContextByUserId(challenge.userId);
    if (!context) {
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.invalidCredentials,
        AUTH_MESSAGES.invalidCredentials,
      );
    }

    await this.sessionService.assertAccountUsable(context);

    const issued = await this.sessionService.issue(
      context,
      input.device,
      new Date(),
    );

    return { issued, context, recoveryCodes };
  }
}
