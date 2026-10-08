import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { CodedUnauthorizedException } from 'src/infra/exceptions/coded.exception';
import { AUTH_MESSAGES } from '../auth.messages';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUserPayload } from '../types/authenticated-user.types';
import { SessionCookieService } from './session-cookie.service';
import { SessionService } from './session.service';
import { AuthContext, StoredSession } from './session.types';
export interface RequestWithSession extends Request {
  user?: AuthenticatedUserPayload;
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
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly cookies: SessionCookieService,
  ) {}
  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        executionContext.getHandler(),
        executionContext.getClass(),
      ])
    )
      return true;
    const request = executionContext
      .switchToHttp()
      .getRequest<RequestWithSession>();
    const secret = this.cookies.read(request);
    if (!secret)
      throw new CodedUnauthorizedException(
        'SESSION_MISSING',
        AUTH_MESSAGES.userNotAuthenticated,
      );
    const { session, context } = await this.sessions.validate(secret);
    const expected = request.get('x-session-context');
    if (expected && expected !== session.id)
      throw new CodedUnauthorizedException(
        'SESSION_CONTEXT_CHANGED',
        'A conta mudou em outra aba. Entre novamente.',
      );
    request.authSession = session;
    request.authContext = context;
    request.user = toAuthenticatedUser(context);
    return true;
  }
}
