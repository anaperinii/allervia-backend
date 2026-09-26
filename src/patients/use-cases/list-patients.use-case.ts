import { Injectable } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { buildPage, PageDto, resolvePage } from 'src/infra/http/pagination';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { maskCpf } from '../cpf';
import {
  ListPatientsQueryDto,
  PatientListItemDto,
} from '../dtos/patient-read.dto';

@Injectable()
export class ListPatientsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async execute(
    currentUser: AuthenticatedUserPayload,
    query: ListPatientsQueryDto,
  ): Promise<PageDto<PatientListItemDto>> {
    const ability = this.abilityFactory.createForUser(currentUser);
    const scope = accessibleBy(ability, 'read').ofType('Patient');
    const bounds = resolvePage(query);

    const filters: Prisma.PatientWhereInput[] = [scope, { isArchived: false }];

    if (query.isActive !== undefined) {
      filters.push({ isActive: query.isActive });
    }

    if (query.responsiblePhysicianId) {
      filters.push({ responsiblePhysicianId: query.responsiblePhysicianId });
    }

    const search = query.search?.trim();
    if (search) {
      filters.push({
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search.replace(/\D/g, '') || search } },
        ],
      });
    }

    const where: Prisma.PatientWhereInput = { AND: filters };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        where,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        skip: bounds.skip,
        take: bounds.take,
        select: {
          id: true,
          fullName: true,
          cpf: true,
          birthDate: true,
          phoneNumber: true,
          weightInKg: true,
          isActive: true,
          createdAt: true,
          responsiblePhysician: {
            select: {
              id: true,
              fullName: true,
              councilNumber: true,
              councilUf: true,
            },
          },
          immunotherapies: {
            where: { isArchived: false },
            select: { status: true },
          },
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    return buildPage(
      rows.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        cpfMasked: row.cpf ? maskCpf(row.cpf) : null,
        birthDate: row.birthDate,
        phoneNumber: row.phoneNumber,
        weightInKg: row.weightInKg,
        isActive: row.isActive,
        responsiblePhysician: row.responsiblePhysician,
        therapyCount: row.immunotherapies.length,
        therapyStatuses: row.immunotherapies.map((item) => item.status),
        createdAt: row.createdAt,
      })),
      total,
      bounds,
    );
  }
}
