import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from './audit-log.service';
import { AuditEntry, AuditLogQuery } from './audit.types';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

@Injectable()
export class PrismaAuditLogService extends IAuditLogService {
  constructor(private prismaService: PrismaService) {
    super();
  }

  async record(entry: AuditEntry, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prismaService;

    await client.auditLog.create({
      data: {
        userId: entry.userId,
        organizationId: entry.organizationId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        oldValues: entry.oldValues as Prisma.InputJsonValue | undefined,
        newValues: entry.newValues as Prisma.InputJsonValue | undefined,
        changedFields: entry.changedFields ?? [],
        sessionId: entry.sessionId,
      },
    });
  }

  async findMany(query: AuditLogQuery, where: Prisma.AuditLogWhereInput) {
    const limit = Math.min(query.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    return this.prismaService.auditLog.findMany({
      where: {
        AND: [
          where,
          {
            entityType: query.entityType,
            entityId: query.entityId,
            userId: query.userId,
            action: query.action,
            timestamp:
              query.from || query.to
                ? { gte: query.from, lte: query.to }
                : undefined,
          },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
    });
  }
}
