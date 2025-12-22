export interface UserForAuth {
  id: string;
  email: string;
  password: string;
  type: string;
  organizationId?: string | null;
  roles?: Array<{ roleTag?: string; name?: string }>;
  memberships?: Array<{
    organizationId: string;
    organization: { name: string };
  }>;
  organization?: { name: string };
  professional?: { id: string };
}

export abstract class IUserAuthRepository {
  abstract findByEmailForAuth(email: string): Promise<UserForAuth | null>;
}

