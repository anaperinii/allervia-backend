import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';

interface JwtValidatedPayload {
  sub: string;
  email: string;
  type: AuthenticatedUserPayload['type'];
  roles?: string[];
  activeOrgId: string;
  professionalId?: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
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

  validate(payload: JwtValidatedPayload): AuthenticatedUserPayload {
    return {
      id: payload.sub,
      email: payload.email,
      type: payload.type,
      roles: payload.roles ?? [],
      activeOrgId: payload.activeOrgId,
      professionalId: payload.professionalId ?? null,
    };
  }
}
