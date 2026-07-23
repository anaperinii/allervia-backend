import { Injectable } from '@nestjs/common';
import { IJwtTokenService } from '../interfaces/jwt-token.service.interface';
import { ProfessionalTokenGenerator } from '../strategies/token-generator/professional-token-generator.strategy';
import { PatientTokenGenerator } from '../strategies/token-generator/patient-token-generator.strategy';
import { ITokenGenerator } from '../interfaces/token-generator.interface';

@Injectable()
export class TokenGeneratorFactory {
  constructor(private jwtTokenService: IJwtTokenService) {}

  create(userType: string): ITokenGenerator {
    switch (userType) {
      case 'PROFESSIONAL':
        return new ProfessionalTokenGenerator(this.jwtTokenService);
      case 'PATIENT':
        return new PatientTokenGenerator(this.jwtTokenService);
      default:
        throw new Error(`Tipo de usuário não suportado: ${userType}`);
    }
  }
}
