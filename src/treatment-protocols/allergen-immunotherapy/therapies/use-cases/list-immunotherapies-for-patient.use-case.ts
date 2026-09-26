import { Injectable } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ImmunotherapyListItemDto } from '../dtos/immunotherapy-read.dto';
import { toListItem } from './list-all-immunotherapies.use-case';

@Injectable()
export class ListImmunotherapiesForPatientUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async execute(
    patientId: string,
    currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyListItemDto[]> {
    const ability = this.abilityFactory.createForUser(currentUser);
    const scope = accessibleBy(ability, 'read').ofType('Immunotherapy');

    const where: Prisma.ImmunotherapyWhereInput = {
      AND: [scope, { patientId, isArchived: false }],
    };

    const rows = await this.prisma.immunotherapy.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        immunoType: true,
        administrationRoute: true,
        extract: true,
        status: true,
        revision: true,
        inductionStartDate: true,
        maintenanceStartDate: true,
        createdAt: true,
        patient: {
          select: {
            id: true,
            fullName: true,
            isActive: true,
            responsiblePhysician: { select: { id: true, fullName: true } },
          },
        },
        currentPrescription: { select: { versionId: true, revision: true } },
        doses: {
          where: { status: 'SCHEDULED', isArchived: false },
          orderBy: { scheduledAt: 'asc' },
          take: 1,
          select: { id: true, scheduledAt: true, status: true },
        },
      },
    });

    return rows.map(toListItem);
  }
}
