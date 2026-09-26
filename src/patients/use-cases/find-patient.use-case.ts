import { Injectable, NotFoundException } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { PrismaService } from 'src/infra/database/prisma.service';
import { PATIENT_MESSAGES } from 'src/patients/patient.messages';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { maskCpf } from '../cpf';
import { PatientDetailDto, TherapySummaryDto } from '../dtos/patient-read.dto';

@Injectable()
export class FindPatientUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async execute(
    id: string,
    currentUser: AuthenticatedUserPayload,
  ): Promise<PatientDetailDto> {
    const ability = this.abilityFactory.createForUser(currentUser);
    const scope = accessibleBy(ability, 'read').ofType('Patient');

    const patient = await this.prisma.patient.findFirst({
      where: { AND: [{ id }, scope] },
      select: {
        id: true,
        fullName: true,
        cpf: true,
        birthDate: true,
        phoneNumber: true,
        weightInKg: true,
        isActive: true,
        organizationId: true,
        responsiblePhysicianId: true,
        createdAt: true,
        updatedAt: true,
        responsiblePhysician: {
          select: {
            id: true,
            fullName: true,
            councilNumber: true,
            councilUf: true,
          },
        },
        immunotherapies: {
          where: { isArchived: false },
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
            currentPrescription: {
              select: { versionId: true, revision: true },
            },
            doses: {
              where: { status: 'SCHEDULED', isArchived: false },
              orderBy: { scheduledAt: 'asc' },
              take: 1,
              select: { id: true, scheduledAt: true, status: true },
            },
          },
        },
      },
    });

    if (!patient) {
      throw new NotFoundException(PATIENT_MESSAGES.notFound(id));
    }

    const canUpdate =
      ability.can('update', 'Patient') &&
      (await this.prisma.patient.count({
        where: {
          AND: [{ id }, accessibleBy(ability, 'update').ofType('Patient')],
        },
      })) > 0;

    const therapies: TherapySummaryDto[] = patient.immunotherapies.map(
      (therapy) => ({
        id: therapy.id,
        immunoType: therapy.immunoType,
        administrationRoute: therapy.administrationRoute,
        extract: therapy.extract,
        status: therapy.status,
        revision: therapy.revision,
        inductionStartDate: therapy.inductionStartDate,
        maintenanceStartDate: therapy.maintenanceStartDate,
        prescription: therapy.currentPrescription
          ? {
              versionId: therapy.currentPrescription.versionId,
              revision: therapy.currentPrescription.revision,
            }
          : null,
        nextDose: therapy.doses[0] ?? null,
        createdAt: therapy.createdAt,
      }),
    );

    return {
      id: patient.id,
      fullName: patient.fullName,
      cpfMasked: patient.cpf ? maskCpf(patient.cpf) : null,
      ...(canUpdate ? { cpf: patient.cpf } : {}),
      birthDate: patient.birthDate,
      phoneNumber: patient.phoneNumber,
      weightInKg: patient.weightInKg,
      isActive: patient.isActive,
      responsiblePhysician: patient.responsiblePhysician,
      therapyCount: therapies.length,
      therapyStatuses: therapies.map((therapy) => therapy.status),
      therapies,
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt,
    };
  }
}
