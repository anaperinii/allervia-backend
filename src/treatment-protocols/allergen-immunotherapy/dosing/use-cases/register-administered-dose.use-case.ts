import { Injectable } from '@nestjs/common';
import { IDoseRepository } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface';
import { UpdateDoseData } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/doses.interface';
import { UpdateDoseDto } from 'src/treatment-protocols/allergen-immunotherapy/dosing/dtos/update-dose.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { Dose } from '@prisma/client';
import { IBuildUpPhase } from 'src/treatment-protocols/allergen-immunotherapy/clinical-rules/build-up-phase/build-up-phase.interface';
import { IMaintenancePhase } from 'src/treatment-protocols/allergen-immunotherapy/clinical-rules/maintenance-phase/maintenance-phase.interface';
import { FindDoseUseCase } from './find-dose.use-case';
import { FindImmunotherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/find-immunotherapy.use-case';
import { Immunotherapy } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/entities/immunotherapy.entity';

@Injectable()
export class RegisterAdministeredDoseUseCase {
  constructor(
    private readonly findDoseUseCase: FindDoseUseCase,
    private readonly buildUpProtocol: IBuildUpPhase,
    private readonly maintenanceProtocol: IMaintenancePhase,
    private readonly doseRepository: IDoseRepository,
    private readonly findImmunotherapyUseCase: FindImmunotherapyUseCase,
  ) {}

  async execute(
    id: string,
    dto: UpdateDoseDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<Dose> {
    const dose = await this.findDoseUseCase.execute(
      id,
      currentUser.activeOrgId,
    );

    const immunotherapy = (await this.findImmunotherapyUseCase.execute(
      dose.immunotherapyId,
      currentUser.activeOrgId,
    )) as Immunotherapy;

    // Preparar dados de atualização
    const updateData: Partial<UpdateDoseData> = {
      concentration: dto.concentration,
      volume: dto.volume,
      administeredAt: dto.administeredAt ?? null,
      scheduledAt: dto.scheduledAt ?? null,
      nextIntervalInDays: dto.nextIntervalInDays,
      updatedById: currentUser.id,
    };

    // Se houver administeredAt, atualizar status e administeredById
    if (dto.administeredAt) {
      dose.administered(dto);
      // Copiar o status atualizado da entity para o updateData
      updateData.status = dose.status;
      updateData.administeredById = currentUser.id;
    }

    const updatedDose = await this.doseRepository.update(dose.id, updateData);

    if (dto.administeredAt) {
      if (
        dto.concentration === immunotherapy.targetConcentration &&
        dto.volume === immunotherapy.targetVolume
      ) {
        await this.maintenanceProtocol.registerScheduledMaintenanceDose(
          updatedDose,
          currentUser,
          immunotherapy,
        );
      } else {
        await this.buildUpProtocol.registerNextScheduledDose(
          updatedDose,
          currentUser,
          immunotherapy,
        );
      }
    }

    return updatedDose;
  }
}
