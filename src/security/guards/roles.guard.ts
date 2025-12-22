import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUserPayload } from '../types/auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RoleValidationFactory } from './strategies/role-validation.factory';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private roleValidationFactory: RoleValidationFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const activeUser: AuthenticatedUserPayload = request.user;

    if (!activeUser) {
      return false;
    }

    if (activeUser.type === 'PATIENT') {
      throw new ForbiddenException(
        'Pacientes não podem acessar recursos restritos por role'
      );
    }

    // Usa a factory para obter a estratégia correta baseada no tipo de usuário
    const strategy = this.roleValidationFactory.getStrategy(activeUser.type);
    const hasPermission = strategy.canAccess(requiredRoles, activeUser);

    if (!hasPermission) {
      throw new ForbiddenException(
        `Permissão negada. Roles necessárias: ${requiredRoles.join(', ')}`
      );
    }

    return true;
  }
}
