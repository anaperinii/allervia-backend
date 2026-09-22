import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { buildPage, resolvePage } from 'src/infra/http/pagination';
import { ClinicalExportQueryDto } from './dtos/clinical-export.dto';

const EXPORT_SELECT = {
  id: true,
  status: true,
  scheduledAt: true,
  administeredAt: true,
  administrationEndedAt: true,
  plannedStepId: true,
  administeredStepId: true,
  plannedValues: true,
  administeredValues: true,
  immediateConduct: true,
  createdAt: true,
  performedBy: { select: { id: true, fullName: true } },
  prescription: {
    select: {
      id: true,
      versionId: true,
      resolved: true,
      version: {
        select: {
          number: true,
          protocol: { select: { id: true, name: true } },
        },
      },
    },
  },
  immunotherapy: {
    select: {
      id: true,
      immunoType: true,
      extract: true,
      status: true,
      administrationRoute: true,
      inductionStartDate: true,
      patient: {
        select: {
          id: true,
          fullName: true,
          isActive: true,
          responsiblePhysician: { select: { id: true, fullName: true } },
        },
      },
    },
  },
} satisfies Prisma.DoseSelect;

/**
 * Conjunto completo para exportação: linhas por dose com previsto e realizado
 * separados, versão fixada e fuso da prescrição. O corte temporal (`asOf`)
 * congela o CONJUNTO — só registros criados até o instante entram — para que
 * páginas geradas em momentos diferentes descrevam o mesmo universo; os valores
 * exibidos são os vigentes na geração. A solicitação é registrada em auditoria.
 */
@Injectable()
export class ClinicalExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: IAuditLogService,
    private readonly abilities: AbilityFactory,
  ) {}

  async export(query: ClinicalExportQueryDto, user: AuthenticatedUserPayload) {
    const ability = this.abilities.createForUser(user);
    const bounds = resolvePage(query);
    if (!ability.can('read', 'Dose')) throw new NotFoundException();
    const asOf = new Date(query.asOf);
    if (!Number.isFinite(asOf.getTime()) || asOf.getTime() > Date.now())
      throw new BadRequestException('INVALID_AS_OF');

    const where: Prisma.DoseWhereInput = {
      AND: [
        { immunotherapy: { patient: { organizationId: user.organizationId } } },
        accessibleBy(ability, 'read').ofType('Dose'),
        { createdAt: { lte: asOf } },
        ...(query.status ? [{ immunotherapy: { status: query.status } }] : []),
        ...(query.responsiblePhysicianId
          ? [
              {
                immunotherapy: {
                  patient: {
                    responsiblePhysicianId: query.responsiblePhysicianId,
                  },
                },
              },
            ]
          : []),
      ],
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.dose.findMany({
        where,
        select: EXPORT_SELECT,
        // IDs ULID são monotônicos: ordenação estável garante páginas
        // disjuntas do mesmo universo congelado.
        orderBy: [{ id: 'asc' }],
        skip: bounds.skip,
        take: bounds.take,
      }),
      this.prisma.dose.count({ where }),
    ]);

    // A solicitação é registrada uma vez, na primeira página, com filtros,
    // corte e autor — trilha exigida para qualquer exportação clínica.
    if (bounds.page === 1)
      await this.audit.record({
        userId: user.id,
        organizationId: user.organizationId,
        entityType: 'Organization',
        entityId: user.organizationId,
        action: 'EXPORT_GENERATED',
        newValues: {
          kind: 'CLINICAL_DOSES',
          asOf: asOf.toISOString(),
          filters: {
            status: query.status ?? null,
            responsiblePhysicianId: query.responsiblePhysicianId ?? null,
          },
          rowCount: total,
        },
      });

    const rows = items.map((dose) => {
      const resolved = dose.prescription?.resolved as
        | Record<string, unknown>
        | undefined;
      return {
        doseId: dose.id,
        status: dose.status,
        scheduledAt: dose.scheduledAt,
        administeredAt: dose.administeredAt,
        administrationEndedAt: dose.administrationEndedAt,
        planned: dose.plannedValues,
        administered: dose.administeredValues,
        immediateConduct: dose.immediateConduct,
        performedBy: dose.performedBy,
        prescription: dose.prescription
          ? {
              versionId: dose.prescription.versionId,
              protocolName: dose.prescription.version.protocol.name,
              versionNumber: dose.prescription.version.number,
              timeZone:
                typeof resolved?.timeZone === 'string'
                  ? resolved.timeZone
                  : null,
            }
          : null,
        therapy: {
          id: dose.immunotherapy.id,
          immunoType: dose.immunotherapy.immunoType,
          extract: dose.immunotherapy.extract,
          status: dose.immunotherapy.status,
          administrationRoute: dose.immunotherapy.administrationRoute,
          inductionStartDate: dose.immunotherapy.inductionStartDate,
        },
        patient: dose.immunotherapy.patient,
      };
    });
    return { ...buildPage(rows, total, bounds), asOf: asOf.toISOString() };
  }
}
