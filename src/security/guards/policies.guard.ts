import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import {
  CHECK_POLICIES_KEY,
  RequiredRule,
} from 'src/security/permissions/ability/check-policies.decorator';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { AUTH_MESSAGES } from 'src/security/auth.messages';
import { IS_PUBLIC_KEY } from 'src/security/decorators/public.decorator';
import { AUTHENTICATED_ONLY_KEY } from 'src/security/decorators/authenticated-only.decorator';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const rules =
      this.reflector.getAllAndOverride<RequiredRule[]>(
        CHECK_POLICIES_KEY,
        targets,
      ) ?? [];

    if (rules.length === 0) {
      const authenticatedOnly = this.reflector.getAllAndOverride<boolean>(
        AUTHENTICATED_ONLY_KEY,
        targets,
      );

      if (authenticatedOnly) {
        return true;
      }

      throw new ForbiddenException(AUTH_MESSAGES.forbidden);
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUserPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(AUTH_MESSAGES.userNotAuthenticated);
    }

    const ability = this.abilityFactory.createForUser({
      id: user.id,
      organizationId: user.organizationId,
      professionalId: user.professionalId,
      roles: user.roles,
    });

    const allowed = rules.every((rule) =>
      ability.can(rule.action, rule.subject),
    );

    if (!allowed) {
      throw new ForbiddenException(AUTH_MESSAGES.forbidden);
    }

    return true;
  }
}
