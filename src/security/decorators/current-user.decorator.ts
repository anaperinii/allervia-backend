import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import type { RequestWithSession } from '../session/session-auth.guard';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUserPayload => {
    const request = ctx.switchToHttp().getRequest<RequestWithSession>();
    return request.user as AuthenticatedUserPayload;
  },
);
