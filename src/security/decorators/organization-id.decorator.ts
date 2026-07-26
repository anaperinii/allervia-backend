import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { AUTH_MESSAGES } from 'src/security/auth.messages';

export const OrganizationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUserPayload;

    if (!user) {
      throw new BadRequestException(AUTH_MESSAGES.userNotAuthenticated);
    }

    if (!user.organizationId) {
      throw new ForbiddenException(AUTH_MESSAGES.organizationNotSet);
    }

    return user.organizationId;
  },
);
