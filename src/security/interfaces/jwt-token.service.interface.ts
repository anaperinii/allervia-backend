export interface TokenPayload {
  sub: string;
  email: string;
  type: string;
  organizationId?: string;
  activeOrgId?: string;
  roles?: string[];
  memberships?: Array<{ organizationId: string; organizationName: string }>;
}

export abstract class IJwtTokenService {
  abstract generateToken(payload: TokenPayload): Promise<string>;
  abstract validateToken(token: string): Promise<TokenPayload>;
}
