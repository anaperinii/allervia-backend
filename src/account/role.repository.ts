import { ProfessionalRole, Role } from '@prisma/client';
import { ITransactionContext } from 'src/database/transaction.interface';

export abstract class IRoleRepository {
  abstract grant(
    data: { professionalId: string; role: Role; grantedById: string },
    tx?: ITransactionContext,
  ): Promise<ProfessionalRole>;

  abstract findById(
    id: string,
    tx?: ITransactionContext,
  ): Promise<ProfessionalRole | null>;

  abstract findActiveByProfessional(
    professionalId: string,
    tx?: ITransactionContext,
  ): Promise<ProfessionalRole[]>;

  abstract findActiveByProfessionalAndRole(
    professionalId: string,
    role: Role,
    tx?: ITransactionContext,
  ): Promise<ProfessionalRole | null>;

  abstract revoke(
    id: string,
    revokedById: string,
    tx?: ITransactionContext,
  ): Promise<ProfessionalRole>;
}
