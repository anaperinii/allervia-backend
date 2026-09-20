import { Injectable } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { buildPage, PageDto, resolvePage } from 'src/infra/http/pagination';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import {
  ImmunotherapyListItemDto,
  ListImmunotherapiesQueryDto,
} from '../dtos/immunotherapy-read.dto';

const LIST_SELECT = {
  id: true,
  immunoType: true,
  administrationRoute: true,
  extract: true,
  status: true,
  revision: true,
  inductionStartDate: true,
  maintenanceStartDate: true,
  createdAt: true,
  patient: {
    select: {
      id: true,
      fullName: true,
      isActive: true,
      responsiblePhysician: { select: { id: true, fullName: true } },
    },
  },
  prescription: { select: { versionId: true, revision: true } },
  doses: {
    where: { status: 'SCHEDULED' as const, isArchived: false },
    orderBy: { scheduledAt: 'asc' as const },
    take: 1,
    select: { id: true, scheduledAt: true, status: true },
  },
} satisfies Prisma.ImmunotherapySelect;

type ListRow = Prisma.ImmunotherapyGetPayload<{ select: typeof LIST_SELECT }>;

export function toListItem(row: ListRow): ImmunotherapyListItemDto {
  return {
    id: row.id,
    immunoType: row.immunoType,
    administrationRoute: row.administrationRoute,
    extract: row.extract,
    status: row.status,
    revision: row.revision,
    inductionStartDate: row.inductionStartDate,
    maintenanceStartDate: row.maintenanceStartDate,
    patient: {
      id: row.patient.id,
      fullName: row.patient.fullName,
      isActive: row.patient.isActive,
    },
    responsiblePhysician: row.patient.responsiblePhysician,
    prescription: row.prescription
      ? {
          versionId: row.prescription.versionId,
          revision: row.prescription.revision,
        }
      : null,
    nextDose: row.doses[0] ?? null,
    createdAt: row.createdAt,
  };
}

/**
 * Listagem paginada de tratamentos. O escopo CASL entra na consulta e no total;
 * o item traz paciente e médico por referência, sem fundir identidades.
 */
@Injectable()
export class ListAllImmunotherapiesUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async execute(
    currentUser: AuthenticatedUserPayload,
    query: ListImmunotherapiesQueryDto,
  ): Promise<PageDto<ImmunotherapyListItemDto>> {
    const ability = this.abilityFactory.createForUser(currentUser);
    const scope = accessibleBy(ability, 'read').ofType('Immunotherapy');
    const bounds = resolvePage(query);

    const filters: Prisma.ImmunotherapyWhereInput[] = [scope];

    if (!query.includeArchived) filters.push({ isArchived: false });
    if (query.status) filters.push({ status: query.status });
    if (query.route) filters.push({ administrationRoute: query.route });

    if (query.responsiblePhysicianId) {
      filters.push({
        patient: { responsiblePhysicianId: query.responsiblePhysicianId },
      });
    }

    const search = query.search?.trim();
    if (search) {
      filters.push({
        OR: [
          { patient: { fullName: { contains: search, mode: 'insensitive' } } },
          { extract: { contains: search, mode: 'insensitive' } },
          { immunoType: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.ImmunotherapyWhereInput = { AND: filters };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.immunotherapy.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: bounds.skip,
        take: bounds.take,
        select: LIST_SELECT,
      }),
      this.prisma.immunotherapy.count({ where }),
    ]);

    return buildPage(rows.map(toListItem), total, bounds);
  }
}
