import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { IJwtTokenService } from '../../interfaces/jwt-token.service.interface';
import { ITokenGenerator } from '../../interfaces/token-generator.interface';
import { LoginResponseDto } from '../../dtos/login-response.dto';
import { UserForAuth } from '../../interfaces/user-auth.repository.interface';

@Injectable()
export class AdminTokenGenerator implements ITokenGenerator {
  constructor(
    private readonly jwtTokenService: IJwtTokenService
  ) {}

  async generate(user: UserForAuth, activeOrgId?: string): Promise<LoginResponseDto> {

    if (!user.organizationId) {
      throw new BadRequestException('Profissional sem organização vinculada');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      type: 'ADMIN',
      roles: user.roles?.map(r => r.roleTag || r.name || '') || [],
      activeOrgId: user.organizationId,
    };

    const access_token = await this.jwtTokenService.generateToken(payload);

    return {
      access_token,
      user: {
        type: 'ADMIN',
        activeOrgId: user.organizationId,
        organizationName: user.organization?.name,
      },
    };
  }
}


