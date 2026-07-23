export interface UserForAuth {
  id: string;
  email: string;
  password: string;
  type: string;
  organizationId: string | null;
  professionalId: string | null;
  roles: string[];
}

export abstract class IUserAuthRepository {
  abstract findByEmailForAuth(email: string): Promise<UserForAuth | null>;
}
