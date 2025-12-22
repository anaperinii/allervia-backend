import { UserType } from '@prisma/client';

export class UserResponseDto {
  id: string;
  fullName: string;
  email: string;
  type: UserType;
  organizationId: string | null;
  isActive: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

