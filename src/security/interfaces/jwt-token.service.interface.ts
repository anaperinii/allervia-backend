import { TokenPayload } from 'src/security/types/jwt.types';

export abstract class IJwtTokenService {
  abstract generateToken(payload: TokenPayload): Promise<string>;
  abstract validateToken(token: string): Promise<TokenPayload>;
}
