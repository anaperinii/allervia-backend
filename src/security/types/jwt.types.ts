export interface TokenPayload {
  sub: string;
  email: string;
  type: string;
  activeOrgId?: string;
  professionalId?: string | null;
  roles?: string[];
  tokenVersion?: number;
}
