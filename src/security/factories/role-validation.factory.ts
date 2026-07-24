import { Injectable } from '@nestjs/common';
import { ProfessionalRoleValidationStrategy, RoleValidationStrategy } from 'src/security/strategies/role-validation.strategy';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';


@Injectable()
export class RoleValidationFactory {
  private readonly professionalStrategy = new ProfessionalRoleValidationStrategy();

  getStrategy(userType: AuthenticatedUserPayload['type']): RoleValidationStrategy {
    switch (userType) {
      case 'PROFESSIONAL':
        return this.professionalStrategy;
      default:
        throw new Error(`Unsupported user type: ${userType}`);
    }
  }
}


