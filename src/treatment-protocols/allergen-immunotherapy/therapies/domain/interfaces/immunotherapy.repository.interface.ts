import { Prisma } from '@prisma/client';
import { Immunotherapy } from '../entities/immunotherapy.entity';
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

  abstract findAll(organizationId: string): Promise<Immunotherapy[]>;

  abstract findByPatient(
    patientId: string,
    organizationId: string,
  ): Promise<Immunotherapy[]>;

  abstract findByType(
    type: string,
    organizationId: string,
  ): Promise<Immunotherapy[]>;

  abstract exists(id: string, organizationId: string): Promise<boolean>;
}
