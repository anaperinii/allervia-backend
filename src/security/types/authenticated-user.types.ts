export interface AuthenticatedUserPayload {
  id: string;
  email: string;
  type: 'PATIENT' | 'PROFESSIONAL';
  organizationId: string;
  professionalId: string | null;
  roles: string[];
}
