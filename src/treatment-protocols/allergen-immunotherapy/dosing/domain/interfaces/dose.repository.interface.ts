import { Prisma } from '@prisma/client';
import { Dose } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/entities/dose.entity';
import { CreateDoseData, UpdateDoseData } from './doses.interface';

export abstract class IDoseRepository {
  abstract create(
    dose: CreateDoseData,
    tx?: Prisma.TransactionClient,
  ): Promise<Dose>;

  abstract update(doseId: string, dose: Partial<UpdateDoseData>): Promise<Dose>;

  abstract findById(id: string, orgId: string): Promise<Dose | null>;

  abstract findByImmunotherapy(
    immunotherapyId: string,
    orgId: string,
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
