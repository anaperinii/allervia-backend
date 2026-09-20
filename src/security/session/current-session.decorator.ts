import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AUTH_MESSAGES } from '../auth.messages';
import { RequestWithSession } from './session-auth.guard';
import { AuthContext, StoredSession } from './session.types';

/** Sessão do cookie. Rotas autenticadas por bearer legado não a possuem. */
export const CurrentSession = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): StoredSession => {
    const request = ctx.switchToHttp().getRequest<RequestWithSession>();
    if (!request.authSession) {
      throw new UnauthorizedException(AUTH_MESSAGES.userNotAuthenticated);
    }
    return request.authSession;
  },
);

/** Contexto recarregado do banco nesta requisição. */
export const CurrentAuthContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<RequestWithSession>();
    if (!request.authContext) {
      throw new UnauthorizedException(AUTH_MESSAGES.userNotAuthenticated);
    }
    return request.authContext;
  },
);
