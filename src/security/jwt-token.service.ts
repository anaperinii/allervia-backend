import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  IJwtTokenService,
  TokenPayload,
} from './interfaces/jwt-token.service.interface';

@Injectable()
export class NestJwtTokenService extends IJwtTokenService {
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  generateToken(payload: TokenPayload): Promise<string> {
    return Promise.resolve(this.jwtService.sign(payload));
  }

  validateToken(token: string): Promise<TokenPayload> {
    return Promise.resolve(this.jwtService.verify<TokenPayload>(token));
  }
}
