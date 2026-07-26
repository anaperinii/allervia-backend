import { Injectable, NotFoundException } from '@nestjs/common';
import { Dose } from '@prisma/client';
import { IDoseRepository } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface';
import { DOSE_MESSAGES } from 'src/treatment-protocols/allergen-immunotherapy/dosing/dose.messages';
import { UpdateDoseStatusDto } from 'src/treatment-protocols/allergen-immunotherapy/dosing/dtos/update-dose-status.dto';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

@Injectable()
export class UpdateDoseStatusUseCase {
  constructor(private readonly doseRepository: IDoseRepository) {}

  async execute(
    id: string,
    dto: UpdateDoseStatusDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<Dose> {
    const dose = await this.doseRepository.findById(
      id,
      currentUser.organizationId,
    );

    if (!dose) {
      throw new NotFoundException(DOSE_MESSAGES.notFound(id));
    }

    dose.changeStatus(dto);
    dose.updatedById = currentUser.id;

    const savedDose = await this.doseRepository.update(dose.id, dose);

    return savedDose;
  }
}
