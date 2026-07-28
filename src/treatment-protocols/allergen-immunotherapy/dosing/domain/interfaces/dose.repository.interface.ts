import { Prisma } from '@prisma/client';
import { Dose } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/entities/dose.entity';
import { CreateDoseData, UpdateDoseData } from './doses.interface';

export abstract class IDoseRepository {
  abstract create(
    dose: CreateDoseData,
    tx?: Prisma.TransactionClient,
  ): Promise<Dose>;

  abstract update(doseId: string, dose: Partial<UpdateDoseData>): Promise<Dose>;

  abstract findByIdAccessible(
    id: string,
    where: Prisma.DoseWhereInput,
  ): Promise<Dose | null>;

  abstract findByImmunotherapyAccessible(
    immunotherapyId: string,
    where: Prisma.DoseWhereInput,
  ): Promise<Dose[]>;

  abstract exists(id: string): Promise<boolean>;

  abstract countDosesByConcentration(
    concentration: number,
    immunotherapyId: string,
    orgId: string,
  ): Promise<number>;

  abstract countDosesByInterval(
    intervalInDays: number,
    immunotherapyId: string,
    orgId: string,
  ): Promise<number>;
}
