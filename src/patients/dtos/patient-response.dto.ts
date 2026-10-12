import { ApiProperty } from '@nestjs/swagger';

export class PatientResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: String, nullable: true })
  userId: string | null;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  responsiblePhysicianId: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ format: 'date-time' })
  birthDate: Date;

  @ApiProperty()
  weightInKg: number;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty({ type: String, nullable: true })
  cpf: string | null;

  @ApiProperty({ type: String, nullable: true })
  guardianName: string | null;

  @ApiProperty({ type: String, nullable: true })
  guardianCpf: string | null;

  @ApiProperty({ type: String, nullable: true })
  guardianPhoneNumber: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isArchived: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty()
  createdById: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;

  @ApiProperty()
  updatedById: string;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  archivedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  archivedById: string | null;
}
