import { BadRequestException, Injectable } from '@nestjs/common';
import { IJwtTokenService } from '../../interfaces/jwt-token.service.interface';
import { ITokenGenerator } from '../../interfaces/token-generator.interface';
import { LoginResponseDto } from '../../dtos/login-response.dto';
import { UserForAuth } from '../../interfaces/user-auth.repository.interface';

@Injectable()
export class ProfessionalTokenGenerator implements ITokenGenerator {
  constructor(private jwtTokenService: IJwtTokenService) {}

  async generate(user: UserForAuth, activeOrgId?: string): Promise<LoginResponseDto> {
    if (!user.organizationId) {
      throw new BadRequestException('Profissional sem organização vinculada');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      type: 'PROFESSIONAL',
      activeOrgId: user.organizationId,
      roles: user.roles?.map(r => r.roleTag || r.name || '') || [],
    };

    const access_token = await this.jwtTokenService.generateToken(payload);

    return {
      access_token,
      user: {
        type: 'PROFESSIONAL',
        activeOrgId: user.organizationId,
        organizationName: user.organization?.name,
      },
    };
  }
}


