import { BadRequestException, Injectable } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { buildPage, resolvePage } from 'src/infra/http/pagination';
import { localCalendarDay } from 'src/utils/protocol-calendar';
import {
  ScheduleQueryDto,
  SchedulePeriodDto,
} from './dtos/clinical-schedule.dto';

function localDay(date: Date, zone: string): string {
  const [year, month, day] = localCalendarDay(date, zone).split('-');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function period(dto: SchedulePeriodDto): { from: Date; to: Date } {
  const from = new Date(dto.from);
  const to = new Date(dto.to);
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from > to
  )
    throw new BadRequestException('INVALID_PERIOD');
  return { from, to };
}

const SCHEDULE_SELECT = {
  id: true,
  immunotherapyId: true,
  status: true,
  scheduledAt: true,
  administeredAt: true,
  administrationEndedAt: true,
  plannedStepId: true,
  administeredStepId: true,
  plannedValues: true,
  administeredValues: true,
  revision: true,
  immunotherapy: {
    select: {
      id: true,
      immunoType: true,
      extract: true,
      status: true,
      revision: true,
      patient: {
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
          isActive: true,
          responsiblePhysician: { select: { id: true, fullName: true } },
        },
      },
    },
  },
} satisfies Prisma.DoseSelect;

@Injectable()
export class ClinicalScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilityFactory,
  ) {}

  private doseScope(user: AuthenticatedUserPayload) {
    const ability = this.abilities.createForUser(user);
    if (!ability.can('read', 'Dose')) return null;
    return accessibleBy(ability, 'read').ofType('Dose');
  }

  async list(query: ScheduleQueryDto, user: AuthenticatedUserPayload) {
    const scope = this.doseScope(user);
    const bounds = resolvePage(query);
    if (!scope) return buildPage([], 0, bounds);
    const { from, to } = period(query);
    const where: Prisma.DoseWhereInput = {
      AND: [
        { immunotherapy: { patient: { organizationId: user.organizationId } } },
        scope,
        { isArchived: false },
        {
          OR: [
            { administeredAt: { gte: from, lte: to } },
            { administeredAt: null, scheduledAt: { gte: from, lte: to } },
          ],
        },
        ...(query.status ? [{ status: query.status }] : []),
        ...(query.search
          ? [
              {
                immunotherapy: {
                  patient: {
                    fullName: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              },
            ]
          : []),
        ...(query.responsiblePhysicianId
          ? [
              {
                immunotherapy: {
                  patient: {
                    responsiblePhysicianId: query.responsiblePhysicianId,
                  },
                },
              },
            ]
          : []),
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dose.findMany({
        where,
        select: SCHEDULE_SELECT,
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        skip: bounds.skip,
        take: bounds.take,
      }),
      this.prisma.dose.count({ where }),
    ]);
    return buildPage(items, total, bounds);
  }

  async metrics(dto: SchedulePeriodDto, user: AuthenticatedUserPayload) {
    const scope = this.doseScope(user);
    const { from, to } = period(dto);
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
      select: { timeZone: true },
    });
    const zone = organization.timeZone;
    const empty = {
      from: from.toISOString(),
      to: to.toISOString(),
      timeZone: zone,
      applications: {
        total: 0,
        onSchedule: 0,
        offSchedule: 0,
        byDay: [] as { day: string; count: number }[],
      },
      scheduled: { pending: 0, overdue: 0 },
      adherence: { numerator: 0, denominator: 0, ratio: null as number | null },
      therapies: {
        inProgress: 0,
        suspended: 0,
        completed: 0,
        buildUp: 0,
        maintenance: 0,
      },
    };
    if (!scope) return empty;

    const doses = await this.prisma.dose.findMany({
      where: {
        AND: [
          {
            immunotherapy: { patient: { organizationId: user.organizationId } },
          },
          scope,
          { isArchived: false },
          {
            OR: [
              { administeredAt: { gte: from, lte: to } },
              { administeredAt: null, scheduledAt: { gte: from, lte: to } },
            ],
          },
        ],
      },
      select: { status: true, scheduledAt: true, administeredAt: true },
    });

    const now = new Date();
    const byDay = new Map<string, number>();
    for (const dose of doses) {
      if (!dose.administeredAt) continue;
      const day = localDay(dose.administeredAt, zone);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    const administered = doses.filter((dose) => dose.administeredAt !== null);
    const onSchedule = administered.filter(
      (dose) => dose.status === 'ADMINISTERED_ON_SCHEDULE',
    ).length;
    const scheduled = doses.filter(
      (dose) => dose.administeredAt === null && dose.status === 'SCHEDULED',
    );
    const overdue = scheduled.filter((dose) => dose.scheduledAt < now).length;

    const therapyAbility = this.abilities.createForUser(user);
    const therapies = therapyAbility.can('read', 'Immunotherapy')
      ? await this.prisma.immunotherapy.groupBy({
          by: ['status'],
          where: {
            AND: [
              { patient: { organizationId: user.organizationId } },
              accessibleBy(therapyAbility, 'read').ofType('Immunotherapy'),
              { isArchived: false },
            ],
          },
          _count: { _all: true },
        })
      : [];
    const therapyCount = (status: string) =>
      therapies.find((row) => row.status === status)?._count._all ?? 0;
    const buildUp = therapyAbility.can('read', 'Immunotherapy')
      ? await this.prisma.immunotherapy.count({
          where: {
            AND: [
              { patient: { organizationId: user.organizationId } },
              accessibleBy(therapyAbility, 'read').ofType('Immunotherapy'),
              { isArchived: false },
              { status: 'IN_PROGRESS', maintenanceStartDate: null },
            ],
          },
        })
      : 0;

    return {
      ...empty,
      applications: {
        total: administered.length,
        onSchedule,
        offSchedule: administered.length - onSchedule,
        byDay: [...byDay.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, count]) => ({ day, count })),
      },
      scheduled: { pending: scheduled.length - overdue, overdue },
      adherence: {
        numerator: onSchedule,
        denominator: administered.length,
        ratio:
          administered.length > 0 ? onSchedule / administered.length : null,
      },
      therapies: {
        inProgress: therapyCount('IN_PROGRESS'),
        suspended: therapyCount('SUSPENDED'),
        completed: therapyCount('COMPLETED'),
        buildUp,
        maintenance: therapyCount('IN_PROGRESS') - buildUp,
      },
    };
  }
}
