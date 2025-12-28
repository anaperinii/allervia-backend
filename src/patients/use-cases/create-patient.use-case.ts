import { Injectable } from '@nestjs/common';
import { Patient } from '../domain/entities/patient.entity';
import { IPatientRepository } from '../domain/interfaces/patient.repository.interface';
import { CreatePatientDto } from '../dtos/create-patient.dto';
import { PatientResponseDto } from '../dtos/patient-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class CreatePatientUseCase {
  constructor(
    private patientRepository: IPatientRepository
  ) {}

  async execute(
    dto: CreatePatientDto,
    currentUser: AuthenticatedUserPayload,
    tx?: ITransactionContext
  ): Promise<PatientResponseDto> {
    
    const patient = Patient.createNew({
      fullName: dto.fullName,
      birthDate: new Date(dto.birthDate),
      weightInKg: dto.weightInKg,
      phoneNumber: dto.phoneNumber,
      primaryOrganizationId: currentUser.activeOrgId,
      createdById: currentUser.id,
      updatedById: currentUser.id
    });
   
    const savedPatient = await this.patientRepository.create(patient, tx);
    
    return savedPatient;
  }
}


