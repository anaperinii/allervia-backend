import { Injectable, NotFoundException } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

/**
 * Histórico clínico do tratamento: a trilha de auditoria da terapia e das suas
 * doses, autorizada pelo ESCOPO CLÍNICO (quem lê o tratamento lê seu
 * histórico) — sem abrir a auditoria administrativa da organização inteira.
 */
@Injectable()
export class ClinicalHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilityFactory,
  ) {}

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
      select: { id: true, doses: { select: { id: true } } },
    });
    if (!therapy) throw new NotFoundException();
    const doseIds = therapy.doses.map((dose) => dose.id);
    const entries = await this.prisma.auditLog.findMany({
      where: {
        organizationId: user.organizationId,
        OR: [
          { entityType: 'Immunotherapy', entityId: id },
          ...(doseIds.length > 0
            ? [{ entityType: 'Dose', entityId: { in: doseIds } }]
            : []),
        ],
      },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: 200,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        newValues: true,
        oldValues: true,
        timestamp: true,
        user: {
          select: {
            id: true,
            professional: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    return { therapyId: id, entries };
  }
}
