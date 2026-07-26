import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { IUserAuthRepository } from 'src/security/interfaces/user-auth.repository.interface';
import { AUTH_MESSAGES } from 'src/security/auth.messages';

interface JwtValidatedPayload {
  sub: string;
  email: string;
  type: AuthenticatedUserPayload['type'];
  roles?: string[];
  organizationId: string;
  professionalId?: string | null;
  tokenVersion?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly userAuthRepository: IUserAuthRepository,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(
    payload: JwtValidatedPayload,
  ): Promise<AuthenticatedUserPayload> {
    const currentVersion = await this.userAuthRepository.getCurrentTokenVersion(
      payload.sub,
    );

    if (
      currentVersion === null ||
      currentVersion !== (payload.tokenVersion ?? 0)
    ) {
      throw new UnauthorizedException(AUTH_MESSAGES.sessionExpired);
    }

    return {
      id: payload.sub,
      email: payload.email,
      type: payload.type,
      roles: payload.roles ?? [],
      organizationId: payload.organizationId,
      professionalId: payload.professionalId ?? null,
    };
  }
}
