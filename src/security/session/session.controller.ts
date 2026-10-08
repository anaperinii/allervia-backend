import { PreAuthCsrf } from './preauth-csrf.decorator';
import { SkipCsrf } from './skip-csrf.decorator';
import {
  CodedForbiddenException,
  CodedUnauthorizedException,
} from 'src/infra/exceptions/coded.exception';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthSessionRevokeReason } from '@prisma/client';
import type { Request, Response } from 'express';
import { AUTH_MESSAGES } from '../auth.messages';
import { AuthenticatedOnly } from '../decorators/authenticated-only.decorator';
import { Public } from '../decorators/public.decorator';
import { CsrfService } from './csrf.service';
import {
  CurrentAuthContext,
  CurrentSession,
} from './current-session.decorator';
import {
  ConfirmMfaEnrollmentDto,
  CsrfTokenResponseDto,
  DeviceSessionDto,
  EnrollMfaDto,
  MfaChallengeDto,
  MfaEnrollmentStartDto,
  MfaFactorDto,
  RecoveryCodesDto,
  ReauthenticateDto,
  SessionEnvelopeDto,
  StartSessionDto,
  VerifyMfaDto,
} from './dtos/session.dtos';
import { MfaService } from './mfa.service';
import { SessionConfig } from './session.config';
import { SessionCookieService } from './session-cookie.service';
import { SessionService } from './session.service';
import type { AuthContext, StoredSession } from './session.types';
import { ReauthenticateUseCase } from './use-cases/reauthenticate.use-case';
import { StartSessionUseCase } from './use-cases/start-session.use-case';
import { VerifyMfaChallengeUseCase } from './use-cases/verify-mfa-challenge.use-case';

@ApiTags('auth')
@Controller('auth')
export class SessionController {
  constructor(
    private readonly startSession: StartSessionUseCase,
    private readonly verifyMfaChallenge: VerifyMfaChallengeUseCase,
    private readonly reauthenticate: ReauthenticateUseCase,
    private readonly sessionService: SessionService,
    private readonly mfaService: MfaService,
    private readonly cookies: SessionCookieService,
    private readonly csrf: CsrfService,
    private readonly config: SessionConfig,
  ) {}

  @Get('csrf')
  @Public()
  @ApiOkResponse({ type: CsrfTokenResponseDto })
  async issueCsrfToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const secret =
      request.query.scope === 'session' ? this.cookies.read(request) : null;
    const found = secret
      ? await this.sessionService.findBySecret(secret)
      : null;
    return {
      csrfToken: found
        ? this.sessionService.csrfForSession(found.session.id)
        : this.csrf.issue(response),
    };
  }

  @PreAuthCsrf()
  @Post('sessions')
  @Public()
  @HttpCode(HttpStatus.OK)
  async createSession(
    @Body() dto: StartSessionDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionEnvelopeDto | MfaChallengeDto> {
    response.setHeader('Cache-Control', 'no-store');

    const result = await this.startSession.execute({
      email: dto.email,
      password: dto.password,
      device: this.cookies.describeDevice(request),
      clientIp: request.ip ?? null,
    });

    if (result.status === 'AUTHENTICATED') {
      this.cookies.set(response, result.issued.sessionSecret);
      this.csrf.clear(response);
      return this.envelope(result.issued.session, result.issued.csrfToken);
    }

    if (result.status === 'MFA_REQUIRED') {
      return {
        status: 'MFA_REQUIRED',
        challengeToken: result.challengeToken,
        expiresAt: result.expiresAt,
      };
    }

    return {
      status: 'MFA_ENROLLMENT_REQUIRED',
      challengeToken: result.challengeToken,
      expiresAt: result.expiresAt,
      enrollment: {
        credentialId: result.credentialId,
        secret: result.secret,
        keyUri: result.keyUri,
      },
    };
  }

  @PreAuthCsrf()
  @Post('mfa/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  async verifySecondFactor(
    @Body() dto: VerifyMfaDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionEnvelopeDto & { recoveryCodes?: string[] }> {
    response.setHeader('Cache-Control', 'no-store');

    const result = await this.verifyMfaChallenge.execute({
      challengeToken: dto.challengeToken,
      code: dto.code,
      device: this.cookies.describeDevice(request),
    });

    this.cookies.set(response, result.issued.sessionSecret);
    this.csrf.clear(response);

    return {
      ...this.envelope(result.issued.session, result.issued.csrfToken),
      ...(result.recoveryCodes ? { recoveryCodes: result.recoveryCodes } : {}),
    };
  }

  @Get('session')
  @AuthenticatedOnly()
  readSession(
    @CurrentSession() session: StoredSession,
    @Res({ passthrough: true }) response: Response,
  ): SessionEnvelopeDto {
    response.setHeader('Cache-Control', 'no-store');
    const csrfToken = this.sessionService.csrfForSession(session.id);
    return this.envelope(session, csrfToken);
  }

  @Post('session/activity')
  @AuthenticatedOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  async registerActivity(
    @CurrentSession() session: StoredSession,
  ): Promise<void> {
    await this.sessionService.registerActivity(session);
  }

  @Get('sessions')
  @AuthenticatedOnly()
  async listDevices(
    @CurrentSession() session: StoredSession,
    @CurrentAuthContext() context: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DeviceSessionDto[]> {
    response.setHeader('Cache-Control', 'no-store');
    const sessions = await this.sessionService.listDevices(context.userId);

    return sessions.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      lastInteractiveAt: item.lastInteractiveAt,
      expiresAt: item.expiresAt,
      userAgent: item.userAgent,
      current: item.id === session.id,
    }));
  }

  @Delete('sessions/:id')
  @AuthenticatedOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeDevice(
    @Param('id') id: string,
    @CurrentAuthContext() context: AuthContext,
    @CurrentSession() session: StoredSession,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const owned = await this.sessionService.findDeviceForUser(
      id,
      context.userId,
    );
    if (!owned) throw new NotFoundException(AUTH_MESSAGES.sessionNotFound);

    await this.sessionService.revoke(
      owned.id,
      AuthSessionRevokeReason.DEVICE_REVOKED,
    );

    if (owned.id === session.id) {
      this.cookies.clear(response);
    }
  }

  @Post('logout')
  @Public()
  @SkipCsrf()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.assertCookieOrigin(request);
    const secret = this.cookies.read(request);
    const found = secret
      ? await this.sessionService.findBySecret(secret)
      : null;
    if (found) {
      this.sessionService.assertCsrf(
        found.session,
        request.get('x-csrf-token'),
      );
      const expected = request.get('x-session-context');
      if (expected && expected !== found.session.id)
        throw new CodedUnauthorizedException(
          'SESSION_CONTEXT_CHANGED',
          'A conta mudou.',
        );
      await this.sessionService.revoke(
        found.session.id,
        AuthSessionRevokeReason.LOGOUT,
      );
    }
    this.cookies.clear(response);
    this.csrf.clear(response);
    response.setHeader('Cache-Control', 'no-store');
  }

  private assertCookieOrigin(request: Request): void {
    const origin = request.get('origin');
    const sameOrigin = request.get('host')
      ? request.protocol + '://' + request.get('host')
      : null;
    if (
      !origin ||
      (!this.config.allowedOrigins.includes(origin) && origin !== sameOrigin) ||
      request.get('content-type')?.split(';')[0].trim().toLowerCase() !==
        'application/json'
    )
      throw new CodedForbiddenException(
        'ORIGIN_NOT_ALLOWED',
        'Origem da requisição não permitida.',
      );
  }

  @Post('logout-all')
  @AuthenticatedOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentAuthContext() context: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessionService.revokeAllForUser(
      context.userId,
      AuthSessionRevokeReason.LOGOUT_ALL,
    );
    this.cookies.clear(response);
    this.csrf.clear(response);
  }

  @Post('reauthenticate')
  @AuthenticatedOnly()
  @HttpCode(HttpStatus.OK)
  async confirmIdentity(
    @Body() dto: ReauthenticateDto,
    @CurrentSession() session: StoredSession,
    @CurrentAuthContext() context: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ reauthenticatedAt: Date; maxAgeSeconds: number }> {
    response.setHeader('Cache-Control', 'no-store');
    const reauthenticatedAt = await this.reauthenticate.execute({
      session,
      context,
      password: dto.password,
      code: dto.code,
    });

    return {
      reauthenticatedAt,
      maxAgeSeconds: Math.floor(this.config.reauthenticationMaxAgeMs / 1000),
    };
  }

  @Get('mfa/factors')
  @AuthenticatedOnly()
  async listFactors(
    @CurrentAuthContext() context: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ factors: MfaFactorDto[]; recoveryCodesRemaining: number }> {
    response.setHeader('Cache-Control', 'no-store');
    return {
      factors: await this.mfaService.listFactors(context.userId),
      recoveryCodesRemaining: await this.mfaService.countRemainingRecoveryCodes(
        context.userId,
      ),
    };
  }

  @Post('mfa/enroll')
  @AuthenticatedOnly()
  @HttpCode(HttpStatus.CREATED)
  async enrollFactor(
    @Body() dto: EnrollMfaDto,
    @CurrentAuthContext() context: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MfaEnrollmentStartDto> {
    response.setHeader('Cache-Control', 'no-store');
    if (!this.mfaService.available) {
      throw new ServiceUnavailableException(AUTH_MESSAGES.mfaKeyUnavailable);
    }

    return this.mfaService.startEnrollment(
      context.userId,
      context.email,
      dto.label ?? 'Aplicativo autenticador',
    );
  }

  @Post('mfa/enroll/confirm')
  @AuthenticatedOnly()
  @HttpCode(HttpStatus.OK)
  async confirmFactor(
    @Body() dto: ConfirmMfaEnrollmentDto,
    @CurrentAuthContext() context: AuthContext,
    @CurrentSession() session: StoredSession,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RecoveryCodesDto> {
    response.setHeader('Cache-Control', 'no-store');
    const confirmation = await this.mfaService.confirmEnrollment(
      context.userId,
      dto.credentialId,
      dto.code,
    );

    this.cookies.set(
      response,
      await this.sessionService.replaceCredential(session),
    );
    await this.sessionService.revokeAllForUser(
      context.userId,
      AuthSessionRevokeReason.MFA_CHANGED,
      session.id,
    );

    return confirmation;
  }

  @Delete('mfa/factors/:id')
  @AuthenticatedOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeFactor(
    @Param('id') id: string,
    @CurrentAuthContext() context: AuthContext,
    @CurrentSession() session: StoredSession,
  ): Promise<void> {
    this.sessionService.assertRecentReauthentication(session);
    await this.mfaService.revokeFactor(context.userId, id);
    await this.sessionService.revokeAllForUser(
      context.userId,
      AuthSessionRevokeReason.MFA_CHANGED,
      session.id,
    );
  }

  @Post('mfa/recovery-codes')
  @AuthenticatedOnly()
  @HttpCode(HttpStatus.OK)
  async regenerateRecoveryCodes(
    @CurrentAuthContext() context: AuthContext,
    @CurrentSession() session: StoredSession,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RecoveryCodesDto> {
    response.setHeader('Cache-Control', 'no-store');
    this.sessionService.assertRecentReauthentication(session);
    return {
      recoveryCodes: await this.mfaService.regenerateRecoveryCodes(
        context.userId,
      ),
    };
  }

  private envelope(
    session: StoredSession,
    csrfToken: string,
  ): SessionEnvelopeDto {
    return {
      authenticated: true,
      csrfToken,
      session: {
        userId: session.userId,
        organizationId: session.organizationId,
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        lastInteractiveAt: session.lastInteractiveAt,
        mfaVerified: session.mfaVerifiedAt !== null,
        reauthenticatedAt: session.reauthenticatedAt,
      },
    };
  }
}
