export interface TokenPayload {
  sub: string;
  email: string;
  type: string;
  organizationId?: string;
  professionalId?: string | null;
  roles?: string[];
  tokenVersion?: number;
}
