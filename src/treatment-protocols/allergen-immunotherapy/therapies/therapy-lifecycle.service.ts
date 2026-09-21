import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { LifecycleEventType, TherapyStatus } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { json } from '../protocol-catalog/protocol-catalog.service';
import { ConfiguredDoseService } from '../dosing/configured-dose.service';
import { TherapyLifecycleDto } from './dtos/therapy-lifecycle.dto';

const TRANSITIONS: Record<
  string,
  { from: TherapyStatus; to: TherapyStatus; type: LifecycleEventType }
> = {
  SUSPEND: {
    from: 'IN_PROGRESS',
    to: 'SUSPENDED',
    type: 'SUSPENSION',
  },
  RESUME: {
    from: 'SUSPENDED',
    to: 'IN_PROGRESS',
    type: 'RESUMPTION',
  },
  COMPLETE: {
    from: 'IN_PROGRESS',
    to: 'COMPLETED',
    type: 'COMPLETION',
  },
};

/**
 * Ciclo de vida clínico com motivo, autoria e efeitos explícitos. O status é
 * consequência do evento — nunca o contrário: cada transição grava o registro
 * completo e a trilha de auditoria na mesma transação.
 */
@Injectable()
export class TherapyLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clinical: ConfiguredDoseService,
    private readonly audit: IAuditLogService,
    private readonly abilities: AbilityFactory,
  ) {}

  async execute(
    id: string,
    dto: TherapyLifecycleDto,
    user: AuthenticatedUserPayload,
  ) {
    const transition = TRANSITIONS[dto.action];
    if (dto.expectedReturnAt && dto.action !== 'SUSPEND')
      throw new BadRequestException('RETURN_FORECAST_ONLY_ON_SUSPENSION');
    if (dto.recommendations && dto.action !== 'COMPLETE')
      throw new BadRequestException('RECOMMENDATIONS_ONLY_ON_COMPLETION');
    return this.prisma.$transaction(async (tx) => {
      const therapy = await this.clinical.lockTherapy(tx, id, user);
      if (therapy.revision !== dto.expectedRevision)
        throw new ConflictException('STALE_CLINICAL_REVISION');
      if (therapy.status !== transition.from)
        throw new ConflictException('INVALID_LIFECYCLE_TRANSITION');

      // Encerrar arquiva as previsões pendentes de forma explícita e auditada;
      // suspensão as preserva para a retomada.
      let archivedDoseIds: string[] = [];
      if (dto.action === 'COMPLETE') {
        const pending = await tx.dose.findMany({
          where: {
            immunotherapyId: id,
            status: 'SCHEDULED',
            isArchived: false,
          },
          select: { id: true },
        });
        archivedDoseIds = pending.map((dose) => dose.id);
        if (archivedDoseIds.length > 0)
          await tx.dose.updateMany({
            where: { id: { in: archivedDoseIds } },
            data: {
              isArchived: true,
              archivedAt: new Date(),
              archivedById: user.id,
            },
          });
      }

      const event = await tx.therapyLifecycleEvent.create({
        data: {
          immunotherapyId: id,
          type: transition.type,
          category: dto.category ?? null,
          reason: dto.reason,
          expectedReturnAt: dto.expectedReturnAt
            ? new Date(dto.expectedReturnAt)
            : null,
          recommendations: dto.recommendations
            ? json(dto.recommendations)
            : undefined,
          archivedDoseIds,
          createdById: user.id,
        },
      });
      const updated = await tx.immunotherapy.update({
        where: { id },
        data: {
          status: transition.to,
          revision: { increment: 1 },
          updatedById: user.id,
        },
      });
      await this.audit.record(
        {
          userId: user.id,
          organizationId: user.organizationId,
          entityType: 'Immunotherapy',
          entityId: id,
          action: 'IMMUNOTHERAPY_STATUS_CHANGED',
          oldValues: { status: therapy.status },
          newValues: {
            status: transition.to,
            lifecycleEventId: event.id,
            reason: dto.reason,
            category: dto.category ?? null,
            archivedDoseIds,
          },
          changedFields: ['status'],
        },
        tx,
      );
      return {
        event,
        status: updated.status,
        revision: updated.revision,
        archivedDoseIds,
      };
    });
  }

  /** Histórico legível do ciclo de vida, do mais recente ao mais antigo. */
  async history(id: string, user: AuthenticatedUserPayload) {
    const ability = this.abilities.createForUser(user);
    if (!ability.can('read', 'Immunotherapy')) throw new NotFoundException();
    const therapy = await this.prisma.immunotherapy.findFirst({
      where: {
        AND: [
          { id, patient: { organizationId: user.organizationId } },
          accessibleBy(ability, 'read').ofType('Immunotherapy'),
        ],
      },
      select: { id: true, status: true, revision: true },
    });
    if (!therapy) throw new NotFoundException();
    const events = await this.prisma.therapyLifecycleEvent.findMany({
      where: { immunotherapyId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        createdBy: {
          select: {
            id: true,
            professional: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    return { therapy, events };
  }
}
