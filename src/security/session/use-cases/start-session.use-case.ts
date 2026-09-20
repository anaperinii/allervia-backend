import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PreAuthPurpose } from '@prisma/client';
import { CodedUnauthorizedException } from 'src/infra/exceptions/coded.exception';
import { IPasswordHashingService } from 'src/security/interfaces/password-hashing.service.interface';
import { AUTH_ERROR_CODES, AUTH_MESSAGES } from 'src/security/auth.messages';
import { IAuthSessionRepository } from '../auth-session.repository';
import {
  AUTH_OPERATIONS,
  AuthRateLimitService,
} from '../auth-rate-limit.service';
import { MfaService } from '../mfa.service';
import { SessionConfig } from '../session.config';
import { generateOpaqueSecret, hashOpaqueSecret } from '../session.crypto';
import { IssuedSession, SessionService } from '../session.service';
import { AuthContext, SessionDeviceMetadata } from '../session.types';

export interface StartSessionInput {
  email: string;
  password: string;
  device: SessionDeviceMetadata;
  clientIp: string | null;
}

export type StartSessionResult =
  | { status: 'AUTHENTICATED'; issued: IssuedSession; context: AuthContext }
  | {
      status: 'MFA_REQUIRED';
      challengeToken: string;
      expiresAt: Date;
    }
  | {
      status: 'MFA_ENROLLMENT_REQUIRED';
      challengeToken: string;
      expiresAt: Date;
      credentialId: string;
      secret: string;
      keyUri: string;
    };

/**
 * Entrada por senha. A resposta nunca distingue e-mail inexistente de senha
 * incorreta, e conta sem acesso válido recebe o mesmo erro, para não enumerar
 * contas. Quando o segundo fator é exigido, esta etapa não cria sessão clínica.
 */
@Injectable()
export class StartSessionUseCase {
  constructor(
    private readonly repository: IAuthSessionRepository,
    private readonly passwordHashing: IPasswordHashingService,
    private readonly sessionService: SessionService,
    private readonly mfaService: MfaService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly config: SessionConfig,
  ) {}

  async execute(input: StartSessionInput): Promise<StartSessionResult> {
    const email = input.email.trim().toLowerCase();

    await this.rateLimit.assertWithinLimit(
      email,
      'account',
      AUTH_OPERATIONS.login,
    );
    if (input.clientIp) {
      await this.rateLimit.assertWithinLimit(
        input.clientIp,
        'ip',
        AUTH_OPERATIONS.login,
      );
    }

    const credentials = await this.repository.findPasswordHashByEmail(email);

    const passwordMatches = credentials
      ? await this.passwordHashing.compare(
          input.password,
          credentials.passwordHash,
        )
      : false;

    if (!credentials || !passwordMatches) {
      await this.registerFailure(email, input.clientIp);
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.invalidCredentials,
        AUTH_MESSAGES.invalidCredentials,
      );
    }

    const context = await this.repository.loadContextByUserId(
      credentials.userId,
    );

    if (!context || !this.accountUsable(context)) {
      await this.registerFailure(email, input.clientIp);
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.invalidCredentials,
        AUTH_MESSAGES.invalidCredentials,
      );
    }

    await this.registerSuccess(email, input.clientIp);

    if (!this.sessionService.requiresSecondFactor(context)) {
      return {
        status: 'AUTHENTICATED',
        issued: await this.sessionService.issue(context, input.device, null),
        context,
      };
    }

    if (context.hasConfirmedMfa) {
      const challenge = await this.createChallenge(
        context.userId,
        PreAuthPurpose.MFA_CHALLENGE,
      );
      return {
        status: 'MFA_REQUIRED',
        challengeToken: challenge.token,
        expiresAt: challenge.expiresAt,
      };
    }

    if (!this.mfaService.available) {
      throw new ServiceUnavailableException(AUTH_MESSAGES.mfaKeyUnavailable);
    }

    const enrollment = await this.mfaService.startEnrollment(
      context.userId,
      context.email,
      'Aplicativo autenticador',
    );
    const challenge = await this.createChallenge(
      context.userId,
      PreAuthPurpose.MFA_ENROLLMENT,
      enrollment.credentialId,
    );

    return {
      status: 'MFA_ENROLLMENT_REQUIRED',
      challengeToken: challenge.token,
      expiresAt: challenge.expiresAt,
      credentialId: enrollment.credentialId,
      secret: enrollment.secret,
      keyUri: enrollment.keyUri,
    };
  }

  private accountUsable(context: AuthContext): boolean {
    return (
      context.isActive &&
      !context.isArchived &&
      context.organizationId !== null &&
      context.organizationIsActive
    );
  }

  private async createChallenge(
    userId: string,
    purpose: PreAuthPurpose,
    credentialId?: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = generateOpaqueSecret();
    const expiresAt = new Date(Date.now() + this.config.preAuthChallengeTtlMs);

    await this.repository.createPreAuthChallenge({
      userId,
      secretHash: hashOpaqueSecret(token),
      purpose,
      expiresAt,
      credentialId: credentialId ?? null,
    });

    return { token, expiresAt };
  }

  private async registerFailure(
    email: string,
    clientIp: string | null,
  ): Promise<void> {
    await this.rateLimit.record(email, 'account', AUTH_OPERATIONS.login, false);
    if (clientIp) {
      await this.rateLimit.record(clientIp, 'ip', AUTH_OPERATIONS.login, false);
    }
  }

  private async registerSuccess(
    email: string,
    clientIp: string | null,
  ): Promise<void> {
    await this.rateLimit.record(email, 'account', AUTH_OPERATIONS.login, true);
    if (clientIp) {
      await this.rateLimit.record(clientIp, 'ip', AUTH_OPERATIONS.login, true);
    }
  }
}
