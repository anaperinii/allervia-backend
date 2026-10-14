import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { maskCpf } from 'src/patients/cpf';

@Injectable()
export class ClinicalHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilityFactory,
  ) {}

  async record(patientId: string, user: AuthenticatedUserPayload) {
    const ability = this.abilities.createForUser(user);
    if (
      !ability.can('read', 'Patient') ||
      !ability.can('read', 'Immunotherapy') ||
      !ability.can('read', 'Dose')
    )
      throw new NotFoundException();
    return this.prisma.$transaction(
      async (tx) => {
        const asOf = new Date().toISOString();
        const patient = await tx.patient.findFirst({
          where: {
            AND: [
              { id: patientId, organizationId: user.organizationId },
              accessibleBy(ability, 'read').ofType('Patient'),
            ],
          },
          include: {
            responsiblePhysician: { select: { id: true, fullName: true } },
          },
        });
        if (!patient) throw new NotFoundException('PATIENT_NOT_FOUND');
        const canReadCpf =
          ability.can('update', 'Patient') &&
          (await tx.patient.count({
            where: {
              AND: [
                { id: patientId },
                accessibleBy(ability, 'update').ofType('Patient'),
              ],
            },
          })) > 0;
        const redactedFields = canReadCpf
          ? []
          : [
              'patient.cpf',
              'patient.guardianCpf',
              'history.*.oldValues.cpf',
              'history.*.newValues.cpf',
            ];
        const publicPatient = {
          ...patient,
          cpf: canReadCpf ? patient.cpf : null,
          cpfMasked: patient.cpf ? maskCpf(patient.cpf) : null,
          guardianCpf: canReadCpf ? patient.guardianCpf : null,
        };
        const doseCount = await tx.dose.count({
          where: {
            AND: [
              { immunotherapy: { patientId } },
              accessibleBy(ability, 'read').ofType('Dose'),
            ],
          },
        });
        if (doseCount > 20000)
          throw new BadRequestException(
            'O prontuário excede o limite de 20.000 doses por pacote. Nenhum arquivo parcial foi gerado.',
          );
        const therapies = await tx.immunotherapy.findMany({
          where: {
            AND: [
              { patientId },
              accessibleBy(ability, 'read').ofType('Immunotherapy'),
            ],
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: {
            prescriptions: {
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              include: {
                version: {
                  select: {
                    id: true,
                    number: true,
                    definition: true,
                    status: true,
                    schemaVersion: true,
                    engineVersion: true,
                    publishedAt: true,
                  },
                },
              },
            },
            lifecycleEvents: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
            doses: {
              where: accessibleBy(ability, 'read').ofType('Dose'),
              orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
              include: {
                observations: {
                  orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                },
                observationAddenda: {
                  orderBy: [{ observedAt: 'asc' }, { id: 'asc' }],
                  include: {
                    createdBy: {
                      select: {
                        id: true,
                        professional: { select: { id: true, fullName: true } },
                      },
                    },
                  },
                },
                administeredBy: {
                  select: {
                    id: true,
                    professional: { select: { id: true, fullName: true } },
                  },
                },
              },
            },
          },
        });
        const doseIds = therapies.flatMap((therapy) =>
          therapy.doses.map((dose) => dose.id),
        );
        const appointments = ability.can('read', 'Appointment')
          ? await tx.appointment.findMany({
              where: {
                AND: [
                  { patientId, organizationId: user.organizationId },
                  accessibleBy(ability, 'read').ofType('Appointment'),
                ],
              },
              orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
              take: 20001,
              include: {
                professional: { select: { id: true, fullName: true } },
              },
            })
          : [];
        if (appointments.length > 20000)
          throw new BadRequestException(
            'O prontuário excede o limite de 20.000 compromissos por pacote. Nenhum arquivo parcial foi gerado.',
          );
        const history = await tx.auditLog.findMany({
          where: {
            organizationId: user.organizationId,
            OR: [
              { entityType: 'Patient', entityId: patientId },
              {
                entityType: 'Immunotherapy',
                entityId: { in: therapies.map((therapy) => therapy.id) },
              },
              { entityType: 'Dose', entityId: { in: doseIds } },
              {
                entityType: 'Appointment',
                entityId: {
                  in: appointments.map((appointment) => appointment.id),
                },
              },
            ],
          },
          orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
          take: 20001,
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            newValues: true,
            oldValues: true,
            timestamp: true,
            user: {
              select: {
                id: true,
                professional: { select: { id: true, fullName: true } },
              },
            },
          },
        });
        if (history.length > 20000 || doseIds.length > 20000)
          throw new BadRequestException(
            'O prontuário excede o limite de 20.000 doses ou eventos por pacote. Nenhum arquivo parcial foi gerado.',
          );
        const redact = (value: Prisma.JsonValue): Prisma.JsonValue => {
          if (Array.isArray(value)) return value.map(redact);
          if (value && typeof value === 'object')
            return Object.fromEntries(
              Object.entries(value).map(([key, nested]) => [
                key,
                /cpf/i.test(key)
                  ? null
                  : nested === undefined
                    ? null
                    : redact(nested),
              ]),
            );
          return value;
        };
        const publicHistory = canReadCpf
          ? history
          : history.map((entry) => ({
              ...entry,
              oldValues: redact(entry.oldValues),
              newValues: redact(entry.newValues),
            }));
        return {
          asOf,
          complete: true,
          redactedFields,
          patient: publicPatient,
          therapies,
          appointments,
          history: publicHistory,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 30000,
      },
    );
  }

  async history(id: string, user: AuthenticatedUserPayload) {
    const ability = this.abilities.createForUser(user);
    if (!ability.can('read', 'Immunotherapy')) throw new NotFoundException();
    const therapy = await this.prisma.immunotherapy.findFirst({
      where: {
        AND: [
          { id, patient: { organizationId: user.organizationId } },
          accessibleBy(ability, 'read').ofType('Immunotherapy'),
        ],
      },
      select: { id: true, doses: { select: { id: true } } },
    });
    if (!therapy) throw new NotFoundException();
    const doseIds = therapy.doses.map((dose) => dose.id);
    const entries = await this.prisma.auditLog.findMany({
      where: {
        organizationId: user.organizationId,
        OR: [
          { entityType: 'Immunotherapy', entityId: id },
          ...(doseIds.length > 0
            ? [{ entityType: 'Dose', entityId: { in: doseIds } }]
            : []),
        ],
      },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: 200,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        newValues: true,
        oldValues: true,
        timestamp: true,
        user: {
          select: {
            id: true,
            professional: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    return { therapyId: id, entries };
  }
}
