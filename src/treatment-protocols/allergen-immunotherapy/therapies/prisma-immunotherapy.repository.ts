import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { Immunotherapy } from './domain/entities/immunotherapy.entity';
import { IImmunotherapyRepository } from './domain/interfaces/immunotherapy.repository.interface';
import { Prisma } from '@prisma/client';

export const TYPE_LIST_MAX_RESULTS = 500;

const IMMUNO_INCLUDE = {
  currentPrescription: true,
  patient: { include: { responsiblePhysician: true } },
  createdBy: { select: { id: true } },
  updatedBy: { select: { id: true } },
};

function toEntity(
  row: { currentPrescription?: unknown } & Record<string, unknown>,
): Immunotherapy {
  return new Immunotherapy({
    ...row,
    prescription: row.currentPrescription ?? null,
  } as never);
}

@Injectable()
export class PrismaImmunotherapyRepository extends IImmunotherapyRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByTypeAccessible(
    type: string,
    where: Prisma.ImmunotherapyWhereInput,
  ): Promise<Immunotherapy[]> {
    const therapies = await this.prisma.immunotherapy.findMany({
      where: { AND: [{ immunoType: type }, { isArchived: false }, where] },
      include: IMMUNO_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: TYPE_LIST_MAX_RESULTS,
    });

    return therapies.map((therapy) => toEntity(therapy));
  }
}
