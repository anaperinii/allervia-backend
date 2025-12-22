export class MembershipResponseDto {
  id: string;
  userId: string;
  organizationId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  organization?: {
    id: string;
    name: string;
  };
}

