import { BadRequestException, Injectable } from '@nestjs/common';
import { IJwtTokenService } from 'src/security/interfaces/jwt-token.service.interface';
import { ITokenGenerator } from 'src/security/interfaces/token-generator.interface';
import { LoginResponseDto } from 'src/security/dtos/login-response.dto';
import { UserForAuth } from 'src/security/types/user-auth.repository.types';
import { AUTH_MESSAGES } from 'src/security/auth.messages';

@Injectable()
export class ProfessionalTokenGenerator implements ITokenGenerator {
  constructor(private jwtTokenService: IJwtTokenService) {}

  async generate(user: UserForAuth): Promise<LoginResponseDto> {
    if (!user.organizationId) {
      throw new BadRequestException(
        AUTH_MESSAGES.professionalWithoutOrganization,
      );
    }

    const payload = {
      sub: user.id,
      email: user.email,
      type: 'PROFESSIONAL',
      activeOrgId: user.organizationId,
      professionalId: user.professionalId,
      roles: user.roles,
      tokenVersion: user.tokenVersion,
    };

    const access_token = await this.jwtTokenService.generateToken(payload);

    return {
      access_token,
      user: {
        type: 'PROFESSIONAL',
        activeOrgId: user.organizationId,
      },
    };
  }
}
