import { Injectable, NotFoundException } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { Dose } from '@prisma/client';
import { IDoseRepository } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface';
import { DOSE_MESSAGES } from 'src/treatment-protocols/allergen-immunotherapy/dosing/dose.messages';
import { UpdateDoseStatusDto } from 'src/treatment-protocols/allergen-immunotherapy/dosing/dtos/update-dose-status.dto';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

@Injectable()
export class UpdateDoseStatusUseCase {
  constructor(
    private readonly doseRepository: IDoseRepository,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async execute(
    id: string,
    dto: UpdateDoseStatusDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<Dose> {
    const ability = this.abilityFactory.createForUser(currentUser);
    const where = accessibleBy(ability, 'update').ofType('Dose');

    const dose = await this.doseRepository.findByIdAccessible(id, where);

    if (!dose) {
      throw new NotFoundException(DOSE_MESSAGES.notFound(id));
    }

    dose.changeStatus(dto);
    dose.updatedById = currentUser.id;

    const savedDose = await this.doseRepository.update(dose.id, dose);

    return savedDose;
  }
}
