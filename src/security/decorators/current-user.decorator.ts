import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUserPayload } from '../types/auth.types';
import { Request } from 'express'; 

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUserPayload => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as AuthenticatedUserPayload;
  },
);