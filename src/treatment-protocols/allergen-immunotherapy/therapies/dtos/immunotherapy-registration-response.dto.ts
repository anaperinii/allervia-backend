import { ApiProperty } from '@nestjs/swagger';
import { AdministrationRoute, TherapyStatus } from '@prisma/client';
import { DoseResponseDto } from './dose-response.dto';

export class PrescriptionSnapshotDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  immunotherapyId: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  versionId: string;

  @ApiProperty({
    type: Object,
    description: 'Seleção resolvida imutável: passos, alvo e fuso horário',
  })
  resolved: unknown;

  @ApiProperty()
  revision: number;

  @ApiProperty({ type: String, nullable: true })
  revisionReason: string | null;

  @ApiProperty()
  createdById: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class RegisteredPatientDto {
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

  @ApiProperty({ type: String, format: 'date-time' })
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

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty()
  createdById: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty()
  updatedById: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archivedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  archivedById: string | null;
}

export class RegisteredImmunotherapyDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  patientId: string;

  @ApiProperty()
  immunoType: string;

  @ApiProperty({ enum: AdministrationRoute })
  administrationRoute: AdministrationRoute;

  @ApiProperty()
  extract: string;

  @ApiProperty({ type: String, format: 'date-time' })
  inductionStartDate: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  maintenanceStartDate: Date | null;

  @ApiProperty()
  targetConcentration: number;

  @ApiProperty({ type: String, description: 'Volume alvo em decimal exato' })
  targetVolume: string;

  @ApiProperty({ enum: TherapyStatus })
  status: TherapyStatus;

  @ApiProperty()
  isArchived: boolean;

  @ApiProperty()
  revision: number;

  @ApiProperty({ type: String, nullable: true })
  currentPrescriptionId: string | null;

  @ApiProperty({ type: PrescriptionSnapshotDto })
  prescription: PrescriptionSnapshotDto;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty()
  createdById: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty()
  updatedById: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archivedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  archivedById: string | null;
}

export class ImmunotherapyRegistrationResponseDto {
  @ApiProperty({ type: RegisteredPatientDto })
  patient: RegisteredPatientDto;

  @ApiProperty({ type: RegisteredImmunotherapyDto })
  immunotherapy: RegisteredImmunotherapyDto;

  @ApiProperty({ type: DoseResponseDto })
  firstDose: DoseResponseDto;
}
