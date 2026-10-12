import { ApiProperty } from '@nestjs/swagger';
import { Profession } from '@prisma/client';

export class ProfessionalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty({ enum: Profession })
  profession: Profession;

  @ApiProperty({ type: String, nullable: true })
  councilNumber: string | null;

  @ApiProperty({ type: String, nullable: true })
  councilUf: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
