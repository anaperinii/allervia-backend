import { UserType } from "@prisma/client";

export class UserProfessionalResponseDto {
  id: string;
  fullName: string;
  email: string;
  type: UserType;
  organizationId: string | null;
  isActive: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  professional: {
    id: string;
    specialty: string;
    phoneNumber: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
  };
}