import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { IJwtTokenService } from '../../domain/services/jwt-token.service.interface';
import { IMembershipRepository } from 'src/memberships/domain/contracts/membership.repository.interface';
import { ITokenGenerator } from './token-generator.interface';
import { LoginResponseDto } from '../dtos/login-response.dto';
import { UserForAuth } from '../../domain/repositories/user-auth.repository.interface';

@Injectable()
export class SystemAdminTokenGenerator implements ITokenGenerator {
  constructor(
    private readonly jwtTokenService: IJwtTokenService,
    private readonly membershipRepository: IMembershipRepository,
  ) {}

  async generate(user: UserForAuth, activeOrgId?: string): Promise<LoginResponseDto> {
    const memberships = await this.membershipRepository.findByUserId(user.id);

    const selectedOrgId = activeOrgId || (memberships.length > 0 ? memberships[0].organizationId : null);

    if (activeOrgId && !memberships.some(m => m.organizationId === activeOrgId)) {
      throw new ForbiddenException('Acesso negado a esta organização');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      type: 'SYSTEM_ADMIN',
      roles: user.roles?.map(r => r.roleTag || r.name || '') || [],
      activeOrgId: selectedOrgId || undefined,
      memberships: memberships.map(m => ({
        organizationId: m.organizationId,
        organizationName: m.organizationName,
      })),
    };

    const access_token = await this.jwtTokenService.generateToken(payload);

    return {
      access_token,
      user: {
        type: 'SYSTEM_ADMIN',
        activeOrgId: selectedOrgId || undefined,
        memberships: payload.memberships,
      },
    };
  }
}

