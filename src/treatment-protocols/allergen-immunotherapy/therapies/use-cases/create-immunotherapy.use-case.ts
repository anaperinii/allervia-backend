import { Injectable } from '@nestjs/common';
import { IImmunotherapyRepository } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/interfaces/immunotherapy.repository.interface';
import { CreateImmunotherapyDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/create-immunotherapy.dto';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ImmunotherapyResponseDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/immunotherapy-response.dto';
import { CreatePatientUseCase } from 'src/patients/use-cases/create-patient.use-case';
import { PrismaService } from 'src/infra/database/prisma.service';
import { Immunotherapy } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/entities/immunotherapy.entity';
import { PatientResponseDto } from 'src/patients/dtos/patient-response.dto';
import { IBuildUpPhase } from 'src/treatment-protocols/allergen-immunotherapy/clinical-rules/build-up-phase/build-up-phase.interface';

@Injectable()
export class CreateImmunotherapyUseCase {
  constructor(
    private readonly immunotherapyRepository: IImmunotherapyRepository,
    private readonly createPatientUseCase: CreatePatientUseCase,
    private readonly prisma: PrismaService,
    private readonly buildUpProtocol: IBuildUpPhase,
  ) {}

  async execute(
    dto: CreateImmunotherapyDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<{
    patient: PatientResponseDto;
    immunotherapy: ImmunotherapyResponseDto;
  }> {
    return await this.prisma.$transaction(async (tx) => {
      const patientDto = await this.createPatientUseCase.execute(
        {
          fullName: dto.patient.fullName,
          birthDate: dto.patient.birthDate,
          weightInKg: dto.patient.weightInKg,
          phoneNumber: dto.patient.phoneNumber,
          responsiblePhysicianId: dto.patient.responsiblePhysicianId,
        },
        currentUser,
        tx,
      );

      const immunotherapy = Immunotherapy.createNew({
        immunoType: dto.immunoType,
        administrationRoute: dto.administrationRoute,
        extract: dto.extract,
        inductionStartDate: new Date(dto.inductionStartDate),
        targetConcentration: dto.targetConcentration,
        targetVolume: dto.targetVolume,
        patientId: patientDto.id,
        createdById: currentUser.id,
        updatedById: currentUser.id,
      });

      const savedImmunotherapy = await this.immunotherapyRepository.create(
        immunotherapy,
        tx,
      );

      await this.buildUpProtocol.registerStartingBuildUpDose(
        savedImmunotherapy,
        currentUser,
        tx,
      );

      return {
        patient: patientDto,
        immunotherapy: savedImmunotherapy,
      };
    });
  }
}
