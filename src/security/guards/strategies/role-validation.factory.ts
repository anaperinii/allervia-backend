import { Injectable } from '@nestjs/common';
import {
  RoleValidationStrategy,
  ProfessionalRoleValidationStrategy,
  AdminRoleValidationStrategy,
  SystemAdminRoleValidationStrategy,
} from './role-validation.strategy';
import { AuthenticatedUserPayload } from '../../types/auth.types';

@Injectable()
export class RoleValidationFactory {
  private readonly professionalStrategy = new ProfessionalRoleValidationStrategy();
  private readonly adminStrategy = new AdminRoleValidationStrategy();
  private readonly systemAdminStrategy = new SystemAdminRoleValidationStrategy();

  getStrategy(userType: AuthenticatedUserPayload['type']): RoleValidationStrategy {
    switch (userType) {
      case 'PROFESSIONAL':
        return this.professionalStrategy;
      case 'ADMIN':
        return this.adminStrategy;
      case 'SYSTEM_ADMIN':
        return this.systemAdminStrategy;
      default:
        throw new Error(`Unsupported user type: ${userType}`);
    }
  }
}


