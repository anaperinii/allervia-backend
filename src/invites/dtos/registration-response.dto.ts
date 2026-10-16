import { ApiProperty } from '@nestjs/swagger';
import { Profession } from '@prisma/client';

export class RegisteredUserDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  professionalId: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty({ enum: Profession })
  profession: Profession;
}
