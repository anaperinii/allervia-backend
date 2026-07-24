import { BadRequestException, Injectable } from '@nestjs/common';
import { IJwtTokenService } from 'src/security/interfaces/jwt-token.service.interface';
import { ITokenGenerator } from 'src/security/interfaces/token-generator.interface';
import { LoginResponseDto } from 'src/security/dtos/login-response.dto';
import { UserForAuth } from 'src/security/interfaces/user-auth.repository.interface';

@Injectable()
export class PatientTokenGenerator implements ITokenGenerator {
  constructor(private readonly jwtTokenService: IJwtTokenService) {}

  async generate(user: UserForAuth): Promise<LoginResponseDto> {
    if (!user.organizationId) {
      throw new BadRequestException('Paciente sem organização vinculada');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      type: 'PATIENT',
      activeOrgId: user.organizationId,
      professionalId: null,
      roles: [],
    };

    const access_token = await this.jwtTokenService.generateToken(payload);

    return {
      access_token,
      user: {
        type: 'PATIENT',
        activeOrgId: user.organizationId,
      },
    };
  }
}
