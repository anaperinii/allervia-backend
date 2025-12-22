import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { IJwtTokenService } from '../../domain/services/jwt-token.service.interface';
import { ITokenGenerator } from './token-generator.interface';
import { LoginResponseDto } from '../dtos/login-response.dto';
import { UserForAuth } from '../../domain/repositories/user-auth.repository.interface';

@Injectable()
export class PatientTokenGenerator implements ITokenGenerator {
  constructor(private readonly jwtTokenService: IJwtTokenService) {}

  async generate(user: UserForAuth, activeOrgId?: string): Promise<LoginResponseDto> {
    if (!user.memberships || user.memberships.length === 0) {
      throw new BadRequestException('Paciente sem organizações vinculadas');
    }

    const selectedOrgId = activeOrgId || user.memberships[0].organizationId;

    const hasAccess = user.memberships.some(m => m.organizationId === selectedOrgId);

    if (!hasAccess) {
      throw new ForbiddenException('Acesso negado a esta organização');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      type: 'PATIENT',
      activeOrgId: selectedOrgId,
      memberships: user.memberships.map(m => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
      })),
    };

    const access_token = await this.jwtTokenService.generateToken(payload);

    return {
      access_token,
      user: {
        type: 'PATIENT',
        activeOrgId: selectedOrgId,
        memberships: payload.memberships,
      },
    };
  }
}

