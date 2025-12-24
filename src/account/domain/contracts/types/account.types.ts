import { UserType } from "@prisma/client";

export interface UserCreationData {
  fullName: string;
  email: string;
  password: string;
  type: UserType;
  organizationId: string | null;
  isActive: boolean;
  isArchived: boolean;
}

export interface UserUpdateData {
  id: string
  fullName: string;
  email: string;
  password: string;
  isActive: boolean;
  isArchived: boolean;
}