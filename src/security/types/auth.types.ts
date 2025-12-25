export interface AuthenticatedUserPayload {
  id: string;
  email: string;
  type: 'PATIENT' | 'PROFESSIONAL' | 'SYSTEM_ADMIN' | 'ADMIN';
  activeOrgId: string;
  roles: string[];
  memberships?: MembershipPayload[]; 
}

export interface MembershipPayload {
  id: string;
  organizationId: string;
  organizationName: string;
}