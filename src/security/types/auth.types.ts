export interface  AuthenticatedUserPayload {
  id: string;
  email: string;
  type: 'PATIENT' | 'PROFESSIONAL' | 'SYSTEM_ADMIN' | 'ADMIN';
  professionalId?: string; 
  activeOrgId: string;
  roles: string[];
  memberships?: MembershipPayload[]; 
}

export interface MembershipPayload {
  organizationId: string;
  organizationName: string;
}