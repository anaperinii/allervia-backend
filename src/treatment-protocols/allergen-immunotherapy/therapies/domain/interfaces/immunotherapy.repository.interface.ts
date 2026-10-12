import { Prisma } from '@prisma/client';
import { Immunotherapy } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/entities/immunotherapy.entity';

export abstract class IImmunotherapyRepository {
  abstract findByTypeAccessible(
    type: string,
    where: Prisma.ImmunotherapyWhereInput,
  ): Promise<Immunotherapy[]>;
}
