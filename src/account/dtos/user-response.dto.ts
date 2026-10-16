import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: UserType })
  type: UserType;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isArchived: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}
