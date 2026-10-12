import { Injectable, NotFoundException } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IDoseRepository } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/dose.repository.interface';
import { Dose } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/entities/dose.entity';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

@Injectable()
export class ListDosesByTherapyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly doseRepository: IDoseRepository,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async execute(
    immunotherapyId: string,
    currentUser: AuthenticatedUserPayload,
  ): Promise<Dose[]> {
    const therapy = await this.prisma.immunotherapy.findFirst({
      where: {
        id: immunotherapyId,
        patient: { organizationId: currentUser.organizationId },
      },
      select: { id: true },
    });
    if (!therapy) throw new NotFoundException('THERAPY_NOT_FOUND');

    const ability = this.abilityFactory.createForUser(currentUser);
    const where = accessibleBy(ability, 'read').ofType('Dose');

    return this.doseRepository.findByImmunotherapyAccessible(
      immunotherapyId,
      where,
    );
  }
}
