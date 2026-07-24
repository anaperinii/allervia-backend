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

  async generateToken(payload: TokenPayload): Promise<string> {
    return this.jwtService.sign(payload);
  }

  async validateToken(token: string): Promise<TokenPayload> {
    return this.jwtService.verify(token);
  }
}
