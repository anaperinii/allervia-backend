export interface AuthenticatedUserPayload {
  id: string;
  email: string;
  type: 'PATIENT' | 'PROFESSIONAL';
  activeOrgId: string;
  professionalId: string | null;
  roles: string[];
}
