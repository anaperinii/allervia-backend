import { ProfessionalRole, Role, Prisma } from '@prisma/client';

export abstract class IRoleRepository {
  abstract grant(
    data: { professionalId: string; role: Role; grantedById: string },
    tx?: Prisma.TransactionClient,
  ): Promise<ProfessionalRole>;

  abstract findById(id: string): Promise<ProfessionalRole | null>;

  abstract findActiveByProfessional(
    professionalId: string,
  ): Promise<ProfessionalRole[]>;

  abstract findActiveByProfessionalAndRole(
    professionalId: string,
    role: Role,
    tx?: Prisma.TransactionClient,
  ): Promise<ProfessionalRole | null>;

  abstract revoke(id: string, revokedById: string): Promise<ProfessionalRole>;
}
