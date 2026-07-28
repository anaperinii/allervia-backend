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

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const rules =
      this.reflector.getAllAndOverride<RequiredRule[]>(CHECK_POLICIES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (rules.length === 0) {
      return true;
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
