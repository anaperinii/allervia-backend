import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import {
  CodedForbiddenException,
  CodedUnauthorizedException,
} from 'src/infra/exceptions/coded.exception';
import { AUTH_ERROR_CODES, AUTH_MESSAGES } from '../auth.messages';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUserPayload } from '../types/authenticated-user.types';
import { IAuthSessionRepository } from './auth-session.repository';
import { SessionConfig } from './session.config';
import { SessionCookieService } from './session-cookie.service';
import { SessionService } from './session.service';
import { AuthContext, StoredSession } from './session.types';

export interface RequestWithSession extends Request {
  authSession?: StoredSession;
  authContext?: AuthContext;
}

export function toAuthenticatedUser(
  context: AuthContext,
): AuthenticatedUserPayload {
  return {
    id: context.userId,
    email: context.email,
    type: context.type,
    organizationId: context.organizationId ?? '',
    professionalId: context.professionalId,
    roles: context.roles,
  };
}

@Injectable()
export class SessionAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
    private readonly cookies: SessionCookieService,
    private readonly repository: IAuthSessionRepository,
    private readonly config: SessionConfig,
  ) {
    super();
  }

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const request = executionContext
      .switchToHttp()
      .getRequest<RequestWithSession>();

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);

    const sessionSecret = this.cookies.read(request);

    if (sessionSecret) {
      try {
        const { session, context } =
          await this.sessionService.validate(sessionSecret);
        request.authSession = session;
        request.authContext = context;
        request.user = toAuthenticatedUser(context);
        await this.sessionService.registerActivity(session);
        return true;
      } catch (error) {
        if (!isPublic) throw error;
        return true;
      }
    }

    if (isPublic) return true;

    const header = request.get('authorization');
    if (!header) {
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.sessionExpired,
        AUTH_MESSAGES.userNotAuthenticated,
      );
    }

    if (this.config.legacyBearer === 'disabled') {
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.legacyBearerDisabled,
        AUTH_MESSAGES.legacyBearerDisabled,
      );
    }

    const authenticated = (await super.canActivate(
      executionContext,
    )) as boolean;
    if (!authenticated) return false;

    await this.applyLegacyBearerRestrictions(request);
    return true;
  }

  private async applyLegacyBearerRestrictions(
    request: RequestWithSession,
  ): Promise<void> {
    const payload = request.user as AuthenticatedUserPayload | undefined;
    if (!payload) {
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.sessionExpired,
        AUTH_MESSAGES.userNotAuthenticated,
      );
    }

    const context = await this.repository.loadContextByUserId(payload.id);
    if (!context) {
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.sessionExpired,
        AUTH_MESSAGES.sessionExpired,
      );
    }

    await this.sessionService.assertAccountUsable(context);

    if (this.sessionService.requiresSecondFactor(context)) {
      throw new CodedForbiddenException(
        AUTH_ERROR_CODES.mfaRequired,
        AUTH_MESSAGES.legacyBearerSecondFactorRequired,
      );
    }

    request.authContext = context;
    request.user = toAuthenticatedUser(context);
  }
}
