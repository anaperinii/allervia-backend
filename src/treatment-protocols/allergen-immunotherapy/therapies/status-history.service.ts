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
import {
  StatusHistoryQueryDto,
  StatusHistoryResponseDto,
} from './dtos/status-history.dto';

export function civilDay(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const read = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${read('year')}-${read('month')}-${read('day')}`;
}

export function statusBuckets(query: StatusHistoryQueryDto, asOf: Date) {
  const parse = (value: string) => {
    const date = new Date(value + 'T00:00:00Z');
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException('INVALID_PERIOD');
    return date;
  };
  const cursor = parse(query.from);
  const end = parse(query.to);
  if (cursor > end || end.getTime() - cursor.getTime() > 366 * 86400000 * 5)
    throw new BadRequestException('INVALID_PERIOD');
  let today: string;
  try {
    today = civilDay(asOf, query.timeZone);
  } catch {
    throw new BadRequestException('INVALID_TIME_ZONE');
  }
  const buckets: { date: string; label: string }[] = [];
  while (cursor <= end && cursor.toISOString().slice(0, 10) <= today) {
    const close = new Date(cursor);
    if (query.granularity === 'month')
      close.setUTCMonth(close.getUTCMonth() + 1, 0);
    else
      close.setUTCDate(close.getUTCDate() + 6 - ((close.getUTCDay() + 6) % 7));
    const date = [close.toISOString().slice(0, 10), query.to, today].sort()[0];
    const label =
      query.granularity === 'month'
        ? new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'UTC',
            month: 'short',
            year: '2-digit',
          }).format(new Date(date + 'T12:00:00Z'))
        : `${date.slice(8, 10)}/${date.slice(5, 7)}`;
    buckets.push({ date, label });
    cursor.setTime(close.getTime() + 86400000);
  }
  return buckets;
}

@Injectable()
export class StatusHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilityFactory,
  ) {}

  async read(
    query: StatusHistoryQueryDto,
    user: AuthenticatedUserPayload,
  ): Promise<StatusHistoryResponseDto> {
    const asOf = new Date();
    const bounds = statusBuckets(query, asOf);
    const ability = this.abilities.createForUser(user);
    if (!ability.can('read', 'Immunotherapy')) throw new NotFoundException();
    const histories = await this.prisma.$transaction(
      (tx) =>
        tx.immunotherapy.findMany({
          where: {
            AND: [
              {
                patient: { organizationId: user.organizationId },
                isArchived: false,
                createdAt: { lte: asOf },
              },
              accessibleBy(ability, 'read').ofType('Immunotherapy'),
            ],
          },
          select: {
            id: true,
            createdAt: true,
            status: true,
            lifecycleEvents: {
              where: { createdAt: { lte: asOf } },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              select: { type: true, createdAt: true },
            },
          },
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const buckets = bounds.map((bound) => {
      const bucket = {
        ...bound,
        active: 0,
        suspended: 0,
        completed: 0,
        unknown: 0,
      };
      for (const history of histories) {
        if (civilDay(history.createdAt, query.timeZone) > bound.date) continue;
        if (
          !history.lifecycleEvents.length &&
          history.status !== 'IN_PROGRESS'
        ) {
          bucket.unknown++;
          continue;
        }
        let state =
          history.lifecycleEvents[0]?.type === 'RESUMPTION'
            ? 'UNKNOWN'
            : 'IN_PROGRESS';
        for (const event of history.lifecycleEvents) {
          if (civilDay(event.createdAt, query.timeZone) > bound.date) break;
          state = {
            SUSPENSION: 'SUSPENDED',
            RESUMPTION: 'IN_PROGRESS',
            COMPLETION: 'COMPLETED',
          }[event.type];
        }
        if (state === 'IN_PROGRESS') bucket.active++;
        else if (state === 'SUSPENDED') bucket.suspended++;
        else if (state === 'COMPLETED') bucket.completed++;
        else bucket.unknown++;
      }
      return bucket;
    });
    return {
      asOf: asOf.toISOString(),
      timeZone: query.timeZone,
      complete: true,
      totalTherapies: histories.length,
      buckets,
    };
  }
}
