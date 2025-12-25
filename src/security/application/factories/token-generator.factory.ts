import { Injectable } from '@nestjs/common';
import { IJwtTokenService } from '../../domain/contracts/jwt-token.service.interface';
import { IMembershipRepository } from 'src/memberships/domain/contracts/membership.repository.interface';
import { ProfessionalTokenGenerator } from '../strategies/professional-token-generator.strategy';
import { SystemAdminTokenGenerator } from '../strategies/system-admin-token-generator.strategy';
import { AdminTokenGenerator } from '../strategies/admin-token-generator.strategy';
import { PatientTokenGenerator } from '../strategies/patient-token-generator.strategy';
import { ITokenGenerator } from '../strategies/token-generator.interface';

@Injectable()
export class TokenGeneratorFactory {
  constructor(
    private jwtTokenService: IJwtTokenService,
    private membershipRepository: IMembershipRepository,  
  ) {}

  create(userType: string): ITokenGenerator {
    switch (userType) {
      case 'PROFESSIONAL':
        return new ProfessionalTokenGenerator(this.jwtTokenService);
      case 'ADMIN':
        return new AdminTokenGenerator(this.jwtTokenService);
      case 'SYSTEM_ADMIN':
        return new SystemAdminTokenGenerator(this.jwtTokenService, this.membershipRepository);
      case 'PATIENT':
        return new PatientTokenGenerator(this.jwtTokenService);
      default:
        throw new Error(`Tipo de usuário não suportado: ${userType}`);
    }
  }
}

