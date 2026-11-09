import { BadRequestException, Injectable } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { civilDay } from './status-history.service';
import {
  PhaseTimelineQueryDto,
  PhaseTimelineResponseDto,
} from './dtos/phase-timeline.dto';

const MAX_DAYS = 366;

function parseDay(value: string): Date {
  const date = new Date(value + 'T00:00:00Z');
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('INVALID_PERIOD');
  return date;
}

function eachDay(from: string, to: string): string[] {
  const cursor = parseDay(from);
  const end = parseDay(to);
  if (cursor > end) throw new BadRequestException('INVALID_PERIOD');
  const days: string[] = [];
  while (cursor <= end && days.length < MAX_DAYS) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

@Injectable()
export class PhaseTimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilityFactory,
  ) {}

  async read(
    query: PhaseTimelineQueryDto,
    user: AuthenticatedUserPayload,
  ): Promise<PhaseTimelineResponseDto> {
    const asOf = new Date();
    const days = eachDay(query.from, query.to);
    const ability = this.abilities.createForUser(user);
    const empty = {
      asOf: asOf.toISOString(),
      timeZone: query.timeZone,
      totalTherapies: 0,
      days: days.map((date) => ({ date, buildUp: 0, maintenance: 0 })),
    };
    if (!ability.can('read', 'Immunotherapy')) return empty;

    let inductionDay: (value: string) => string;
    try {
      civilDay(asOf, query.timeZone);
      inductionDay = (value: string) =>
        civilDay(new Date(value), query.timeZone);
    } catch {
      throw new BadRequestException('INVALID_TIME_ZONE');
    }

    const therapies = await this.prisma.immunotherapy.findMany({
      where: {
        AND: [
          { patient: { organizationId: user.organizationId } },
          accessibleBy(ability, 'read').ofType('Immunotherapy'),
          { isArchived: false },
          { status: 'IN_PROGRESS' },
        ],
      },
      select: {
        patientId: true,
        inductionStartDate: true,
        maintenanceStartDate: true,
      },
    });

    const resolved = therapies.map((therapy) => ({
      patientId: therapy.patientId,
      inductionDay: inductionDay(therapy.inductionStartDate.toISOString()),
      maintenanceDay: therapy.maintenanceStartDate
        ? inductionDay(therapy.maintenanceStartDate.toISOString())
        : null,
    }));

    return {
      asOf: asOf.toISOString(),
      timeZone: query.timeZone,
      totalTherapies: therapies.length,
      days: days.map((day) => {
        const buildUp = new Set<string>();
        const maintenance = new Set<string>();
        for (const therapy of resolved) {
          if (therapy.inductionDay > day) continue;
          if (therapy.maintenanceDay !== null && therapy.maintenanceDay <= day)
            maintenance.add(therapy.patientId);
          else buildUp.add(therapy.patientId);
        }
        return {
          date: day,
          buildUp: buildUp.size,
          maintenance: maintenance.size,
        };
      }),
    };
  }
}
