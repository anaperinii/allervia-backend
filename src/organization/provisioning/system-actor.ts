import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { ORGANIZATION_MESSAGES } from '../organization.messages';

export async function resolveSystemActor(
  tx: Prisma.TransactionClient,
  config: ConfigService,
): Promise<string> {
  const systemUserId = config.get<string>('SYSTEM_USER_ID')?.trim();
  if (!systemUserId) {
    throw new ServiceUnavailableException(
      ORGANIZATION_MESSAGES.provisioningUnavailable,
    );
  }
  const actor = await tx.user.findUnique({
    where: { id: systemUserId },
    select: { id: true },
  });
  if (!actor) {
    throw new ServiceUnavailableException(
      ORGANIZATION_MESSAGES.provisioningUnavailable,
    );
  }
  return actor.id;
}
