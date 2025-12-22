import { AuthenticatedUserPayload } from '../../types/auth.types';

export interface RoleValidationStrategy {
  canAccess(requiredRoles: string[], user: AuthenticatedUserPayload): boolean;
}

export class ProfessionalRoleValidationStrategy implements RoleValidationStrategy {
  canAccess(requiredRoles: string[], user: AuthenticatedUserPayload): boolean {
    return user.roles?.some(role => requiredRoles.includes(role)) ?? false;
  }
}

export class AdminRoleValidationStrategy implements RoleValidationStrategy {
  canAccess(requiredRoles: string[], user: AuthenticatedUserPayload): boolean {
    // ADMIN tem acesso se tiver o role necessário OU se for SYSTEM_ADMIN
    return user.roles?.some(role => requiredRoles.includes(role)) ?? false;
  }
}

export class SystemAdminRoleValidationStrategy implements RoleValidationStrategy {
  canAccess(requiredRoles: string[], user: AuthenticatedUserPayload): boolean {
    return user.roles?.some(role => requiredRoles.includes(role)) ?? false;
  }
}

