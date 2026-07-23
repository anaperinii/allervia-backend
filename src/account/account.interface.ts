import { UserType } from '@prisma/client';

export interface UserCreationData {
  email: string;
  password: string;
  type: UserType;
  isActive?: boolean;
  isArchived?: boolean;
}

export interface UserUpdateData {
  id: string;
  email: string;
  password: string;
  isActive: boolean;
  isArchived: boolean;
}
