import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from './audit-log.service';
import { AuditEntry } from './audit.types';

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
}
