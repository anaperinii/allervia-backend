import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthSessionRevokeReason, Prisma, User } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { SessionService } from 'src/security/session/session.service';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { PROFESSIONAL_MESSAGES } from 'src/professionals/professional.messages';
import { USER_MESSAGES } from './user.messages';

export type RecordAccessAudit = (
  tx: Prisma.TransactionClient,
  before: User,
  after: User,
  professionalId: string | null,
) => Promise<void>;

export interface SetActiveResult {
  before: User;
  after: User;
  changed: boolean;
  professionalId: string | null;
}

@Injectable()
export class UserAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  async setActive(
    targetUserId: string,
    isActive: boolean,
    actor: AuthenticatedUserPayload,
    recordAudit: RecordAccessAudit,
  ): Promise<SetActiveResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findFirst({
        where: {
          id: targetUserId,
          OR: [
            { professional: { organizationId: actor.organizationId } },
            { patient: { organizationId: actor.organizationId } },
          ],
        },
        include: { professional: { select: { id: true } } },
      });

      if (!before) {
        throw new NotFoundException(USER_MESSAGES.notFound(targetUserId));
      }

      if (!isActive && before.id === actor.id) {
        throw new ForbiddenException(PROFESSIONAL_MESSAGES.cannotDisableSelf);
      }

      const professionalId = before.professional?.id ?? null;
      const { professional: _professional, ...beforeUser } = before;

      if (before.isActive === isActive) {
        return {
          before: beforeUser as User,
          after: beforeUser as User,
          changed: false,
          professionalId,
        };
      }

      if (!isActive && professionalId) {

        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.organizationId}))`;
        const targetIsAdministrator = await tx.professionalRole.count({
          where: {
            professionalId,
            role: 'ADMINISTRATOR',
            revokedAt: null,
          },
        });
        if (targetIsAdministrator > 0) {
          const remainingAdministrators = await tx.professional.count({
            where: {
              organizationId: actor.organizationId,
              id: { not: professionalId },
              user: { isActive: true, isArchived: false },
              professionalRoles: {
                some: { role: 'ADMINISTRATOR', revokedAt: null },
              },
            },
          });
          if (remainingAdministrators === 0) {
            throw new ConflictException('LAST_ADMINISTRATOR');
          }
        }
      }

      const after = await tx.user.update({
        where: { id: before.id },
        data: { isActive, tokenVersion: { increment: 1 } },
      });

      if (!isActive) {

        await tx.googleCalendarConnection.updateMany({
          where: {
            professional: { userId: before.id },
            teardownRequestedAt: null,
          },
          data: { teardownRequestedAt: new Date() },
        });
      }

      await recordAudit(tx, beforeUser as User, after, professionalId);

      return {
        before: beforeUser as User,
        after,
        changed: true,
        professionalId,
      };
    });

    if (!isActive && result.changed) {

      await this.sessionService.revokeAllForUser(
        targetUserId,
        AuthSessionRevokeReason.ACCOUNT_DISABLED,
      );
    }

    return result;
  }
}
