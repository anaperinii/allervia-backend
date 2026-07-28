import { Prisma } from '@prisma/client';
import { Immunotherapy } from 'src/treatment-protocols/allergen-immunotherapy/therapies/domain/entities/immunotherapy.entity';
import {
  CreateImmunotherapyData,
  UpdateImmunotherapyData,
} from './immunotherapy.interfaces';

export abstract class IImmunotherapyRepository {
  abstract create(
    immunotherapy: CreateImmunotherapyData,
    tx?: Prisma.TransactionClient,
  ): Promise<Immunotherapy>;

  abstract update(
    immunoId: string,
    immunotherapy: Partial<UpdateImmunotherapyData>,
  ): Promise<Immunotherapy>;

  abstract findById(
    id: string,
    organizationId: string,
  ): Promise<Immunotherapy | null>;

  abstract findByIdAccessible(
    id: string,
    where: Prisma.ImmunotherapyWhereInput,
  ): Promise<Immunotherapy | null>;

  abstract findAllAccessible(
    where: Prisma.ImmunotherapyWhereInput,
  ): Promise<Immunotherapy[]>;

  abstract findByPatientAccessible(
    patientId: string,
    where: Prisma.ImmunotherapyWhereInput,
  ): Promise<Immunotherapy[]>;

  abstract findByTypeAccessible(
    type: string,
    where: Prisma.ImmunotherapyWhereInput,
  ): Promise<Immunotherapy[]>;

  abstract exists(id: string, organizationId: string): Promise<boolean>;
}
