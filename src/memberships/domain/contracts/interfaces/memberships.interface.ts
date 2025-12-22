export interface MembershipInfo {
  organizationId: string;
  organizationName: string;
}

export interface CreateMembershipProps {
  userId: string;
  organizationId: string;
}

export interface UpdateMembershipData {
    id: string;
    userId: string;
    organizationId: string;
    isActive: boolean;
}