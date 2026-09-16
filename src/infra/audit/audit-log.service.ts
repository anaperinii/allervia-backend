import { AuditLog, Prisma } from '@prisma/client';
import { AuditEntry, AuditLogQuery } from './audit.types';

export abstract class IAuditLogService {
  abstract record(
    entry: AuditEntry,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;

  abstract findMany(
    query: AuditLogQuery,
    where: Prisma.AuditLogWhereInput,
  ): Promise<AuditLog[]>;
}
