import { User, UserType } from '@prisma/client';

export class UserResponseDto {
  static from(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      type: user.type,
      isActive: user.isActive,
      isArchived: user.isArchived,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  id: string;
  email: string;
  type: UserType;
  isActive: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
