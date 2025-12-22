import { Injectable } from '@nestjs/common';
import {
  OrganizationContextStrategy,
  ProfessionalOrganizationContextStrategy,
  AdminOrganizationContextStrategy,
  SystemAdminOrganizationContextStrategy,
  PatientOrganizationContextStrategy,
} from './organization-context.strategy';
import { AuthenticatedUserPayload } from '../../types/auth.types';

@Injectable()
export class OrganizationContextFactory {
  private readonly professionalStrategy = new ProfessionalOrganizationContextStrategy();
  private readonly adminStrategy = new AdminOrganizationContextStrategy();
  private readonly systemAdminStrategy = new SystemAdminOrganizationContextStrategy();
  private readonly patientStrategy = new PatientOrganizationContextStrategy();

  getStrategy(userType: AuthenticatedUserPayload['type']): OrganizationContextStrategy {
    switch (userType) {
      case 'PROFESSIONAL':
        return this.professionalStrategy;
      case 'ADMIN':
        return this.adminStrategy;
      case 'SYSTEM_ADMIN':
        return this.systemAdminStrategy;
      case 'PATIENT':
        return this.patientStrategy;
      default:
        throw new Error(`Unsupported user type: ${userType}`);
    }
  }
}

