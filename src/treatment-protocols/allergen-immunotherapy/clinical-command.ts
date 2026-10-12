import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface ClinicalCommandKey {
  organizationId: string;
  actorId: string;
  doseId: string;
  key: string;
}

export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}

export function clinicalCommandHash(
  operation: string,
  payload: unknown,
): string {
  return createHash('sha256')
    .update(JSON.stringify({ operation, payload: canonical(payload) }))
    .digest('hex');
}

export function clinicalCommandKey(
  user: { organizationId: string; id: string },
  subjectId: string,
  idempotencyKey: string | undefined,
): ClinicalCommandKey | null {
  if (!idempotencyKey) return null;
  return {
    organizationId: user.organizationId,
    actorId: user.id,
    doseId: subjectId,
    key: idempotencyKey,
  };
}

export async function replayClinicalCommand(
  tx: Prisma.TransactionClient,
  key: ClinicalCommandKey | null,
  requestHash: string | null,
) {
  if (!key || !requestHash) return null;
  const previous = await tx.clinicalCommand.findUnique({
    where: { organizationId_actorId_doseId_key: key },
  });
  if (!previous) return null;
  if (previous.requestHash !== requestHash)
    throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
  return previous;
}

export async function commitClinicalCommand<T>(
  tx: Prisma.TransactionClient,
  key: ClinicalCommandKey | null,
  requestHash: string | null,
  result: T,
): Promise<T> {
  if (!key || !requestHash) return result;
  const stored = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
  await tx.clinicalCommand.create({
    data: { ...key, requestHash, result: stored },
  });
  return stored as T;
}
