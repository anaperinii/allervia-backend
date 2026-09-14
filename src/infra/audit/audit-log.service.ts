import { Prisma } from '@prisma/client';
import { AuditEntry } from './audit.types';

export abstract class IAuditLogService {
  abstract record(
    entry: AuditEntry,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}
