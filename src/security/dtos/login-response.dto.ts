export interface MembershipInfo {
  organizationId: string;
  organizationName: string;
}

export class LoginResponseDto {
  access_token: string;
  user: {
    type: string;
    organizationId?: string;
    organizationName?: string;
    activeOrgId?: string;
    memberships?: MembershipInfo[];
  };
}


