import { Injectable } from '@nestjs/common';
import { IPatientRepository } from '../../domain/contracts/patient.repository.interface';
import { PatientNotFoundException } from '../../domain/exceptions/patient-not-found.exception';
import { UpdatePatientDto } from '../dtos/update-patient.dto';
import { PatientResponseDto } from '../dtos/patient-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { Prisma } from '@prisma/client';

@Injectable()
export class UpdatePatientUseCase {
  constructor(
    private patientRepository: IPatientRepository
  ) {}

  async execute(
    id: string,
    dto: UpdatePatientDto,
    currentUser: AuthenticatedUserPayload,
    tx?: Prisma.TransactionClient
  ): Promise<PatientResponseDto> {

    const patient = await this.patientRepository.findById(id, currentUser.activeOrgId);

    if (!patient) {
      throw new PatientNotFoundException(id);
    }

    const updatedPatient = await this.patientRepository.update(dto, tx);

    return updatedPatient;
  }
}

