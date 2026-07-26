import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { AUTH_MESSAGES } from 'src/security/auth.messages';

export const ActiveOrganization = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUserPayload;

    if (!user) {
      throw new BadRequestException(AUTH_MESSAGES.userNotAuthenticated);
    }

    if (!user.activeOrgId) {
      throw new ForbiddenException(AUTH_MESSAGES.activeOrganizationNotSet);
    }

    return user.activeOrgId;
  },
);
