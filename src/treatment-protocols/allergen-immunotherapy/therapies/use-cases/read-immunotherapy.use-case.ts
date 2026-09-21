import { Injectable, NotFoundException } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IMMUNOTHERAPY_MESSAGES } from 'src/treatment-protocols/allergen-immunotherapy/therapies/immunotherapy.messages';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ImmunotherapyDetailDto } from '../dtos/immunotherapy-read.dto';

/**
 * Detalhe do tratamento para o prontuário. A prescrição devolvida é o snapshot
 * imutável fixado no cadastro: histórico antigo é lido como foi prescrito, sem
 * reinterpretação pela versão padrão vigente da organização.
 */
@Injectable()
export class ReadImmunotherapyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async execute(
    id: string,
    currentUser: AuthenticatedUserPayload,
  ): Promise<ImmunotherapyDetailDto> {
    const ability = this.abilityFactory.createForUser(currentUser);
    const scope = accessibleBy(ability, 'read').ofType('Immunotherapy');

    const therapy = await this.prisma.immunotherapy.findFirst({
      where: { AND: [{ id }, scope] },
      select: {
        id: true,
        immunoType: true,
        administrationRoute: true,
        extract: true,
        status: true,
        revision: true,
        isArchived: true,
        inductionStartDate: true,
        maintenanceStartDate: true,
        createdAt: true,
        updatedAt: true,
        patient: {
          select: {
            id: true,
            fullName: true,
            isActive: true,
            responsiblePhysician: { select: { id: true, fullName: true } },
          },
        },
        currentPrescription: {
          select: { versionId: true, revision: true, resolved: true },
        },
        _count: {
          select: { doses: { where: { isArchived: false } } },
        },
      },
    });

    if (!therapy) {
      throw new NotFoundException(IMMUNOTHERAPY_MESSAGES.notFound(id));
    }

    const nextDose = await this.prisma.dose.findFirst({
      where: { immunotherapyId: id, status: 'SCHEDULED', isArchived: false },
      orderBy: { scheduledAt: 'asc' },
      select: { id: true, scheduledAt: true, status: true },
    });

    return {
      id: therapy.id,
      immunoType: therapy.immunoType,
      administrationRoute: therapy.administrationRoute,
      extract: therapy.extract,
      status: therapy.status,
      revision: therapy.revision,
      isArchived: therapy.isArchived,
      inductionStartDate: therapy.inductionStartDate,
      maintenanceStartDate: therapy.maintenanceStartDate,
      patient: {
        id: therapy.patient.id,
        fullName: therapy.patient.fullName,
        isActive: therapy.patient.isActive,
      },
      responsiblePhysician: therapy.patient.responsiblePhysician,
      prescription: therapy.currentPrescription
        ? {
            versionId: therapy.currentPrescription.versionId,
            revision: therapy.currentPrescription.revision,
            resolved: therapy.currentPrescription.resolved,
          }
        : null,
      nextDose,
      doseCount: therapy._count.doses,
      createdAt: therapy.createdAt,
      updatedAt: therapy.updatedAt,
    };
  }
}
