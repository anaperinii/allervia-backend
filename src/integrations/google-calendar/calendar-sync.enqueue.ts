import { randomUUID } from 'node:crypto';
import { CalendarSyncJobKind, Prisma } from '@prisma/client';

export interface CalendarSyncJobInput {
  organizationId: string;
  kind: CalendarSyncJobKind;
  appointmentId?: string;
  connectionId?: string;
  payload?: Prisma.InputJsonValue;
}

export function pendingKeyFor(input: CalendarSyncJobInput): string | null {
  if (input.kind === 'PUSH_SYNC' && input.appointmentId) {
    return `PUSH:${input.appointmentId}`;
  }
  if (
    (input.kind === 'PULL_INCREMENTAL' || input.kind === 'PULL_FULL_RESYNC') &&
    input.connectionId
  ) {
    return `PULL:${input.connectionId}`;
  }
  return null;
}

export async function enqueueCalendarSync(
  tx: Prisma.TransactionClient,
  input: CalendarSyncJobInput,
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO "CalendarSyncJob"
      ("id", "organizationId", "kind", "appointmentId", "connectionId", "payload", "pendingKey")
    VALUES (
      ${randomUUID()},
      ${input.organizationId},
      ${input.kind}::"CalendarSyncJobKind",
      ${input.appointmentId ?? null},
      ${input.connectionId ?? null},
      ${input.payload !== undefined ? JSON.stringify(input.payload) : null}::jsonb,
      ${pendingKeyFor(input)}
    )
    ON CONFLICT DO NOTHING
  `;
}
