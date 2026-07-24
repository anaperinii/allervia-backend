import { Injectable } from '@nestjs/common';
import { PatientRepository } from '../patient.repository';
import { CreatePatientDto } from '../dtos/create-patient.dto';
import { PatientResponseDto } from '../dtos/patient-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { Prisma } from '@prisma/client';

@Injectable()
export class CreatePatientUseCase {
  constructor(
    private patientRepository: PatientRepository
  ) {}

  async execute(
    dto: CreatePatientDto,
    currentUser: AuthenticatedUserPayload,
    tx?: Prisma.TransactionClient
  ) {
   
    const savedPatient = await this.patientRepository.create(
      {
        fullName: dto.fullName,
        birthDate: dto.birthDate,
        weightInKg: dto.weightInKg,
        phoneNumber: dto.phoneNumber,
        organizationId: currentUser.activeOrgId,
        createdById: currentUser.id,
        updatedById: currentUser.id,
        isActive: true,
        isArchived: false,
      },
      tx,
    );

    return savedPatient;
  }
}


