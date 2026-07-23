import { UserType } from '@prisma/client';

export class UserResponseDto {
  id: string;
  email: string;
  type: UserType;
  isActive: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

