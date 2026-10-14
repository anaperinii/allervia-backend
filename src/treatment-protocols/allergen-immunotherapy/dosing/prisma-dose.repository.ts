import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { Dose } from './domain/entities/dose.entity';
import { IDoseRepository } from './domain/interfaces/dose.repository.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaDoseRepository extends IDoseRepository {
  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async findByImmunotherapyAccessible(
    immunotherapyId: string,
    where: Prisma.DoseWhereInput,
  ): Promise<Dose[]> {
    const doses = await this.prismaService.dose.findMany({
      where: { AND: [{ immunotherapyId }, where] },
      orderBy: [{ administeredAt: 'desc' }, { id: 'desc' }],
      include: { prescription: { select: { resolved: true } } },
    });

    return doses.map((dose) => {
      const resolved = dose.prescription?.resolved;
      const timeZone = resolved && typeof resolved === 'object' && !Array.isArray(resolved) && typeof resolved.timeZone === 'string' ? resolved.timeZone : null;
      return new Dose({ ...dose, timeZone });
    });
  }
}
