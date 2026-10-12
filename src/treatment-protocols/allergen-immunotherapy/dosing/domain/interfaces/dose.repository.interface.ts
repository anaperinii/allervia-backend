import { Prisma } from '@prisma/client';
import { Dose } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/entities/dose.entity';

export abstract class IDoseRepository {
  abstract findByImmunotherapyAccessible(
    immunotherapyId: string,
    where: Prisma.DoseWhereInput,
  ): Promise<Dose[]>;
}
