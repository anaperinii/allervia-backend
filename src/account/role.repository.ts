import { UserRoleResponseDto } from 'src/account/dtos/roles/user-role-respose.dto';
import { Role, ProfessionalRole } from '@prisma/client';
import { ITransactionContext } from 'src/database/transaction.interface';

export abstract class IRoleRepository {
  abstract create(role: CreateRoleProps, tx?: ITransactionContext): Promise<ProfessionalRole>;

  abstract createUserRole(userId: string, roleName: Role, tx?: ITransactionContext): Promise<ProfessionalRole>;

  abstract update(role: Role, tx?: ITransactionContext): Promise<ProfessionalRole>;

  abstract findById(
    id: string,
    organizationId: string
  ): Promise<ProfessionalRole | null>;

  abstract findByName(
    name: Role,
    organizationId: string
  ): Promise<ProfessionalRole | null>;

  abstract findAllActive(
    organizationId: string
  ): Promise<ProfessionalRole[]>;

  abstract exists(
    id: string,
    organizationId: string
  ): Promise<boolean>;

  abstract hasActiveUserRoles(
    roleName: Role,
    organizationId: string
  ): Promise<boolean>;

  abstract findRolesByUsers(
    roleName: Role,
    organizationId: string
  ): Promise<UserRoleResponseDto[]>;

  abstract findUserRoleByName(
    roleName: Role,
    userId: string
  ): Promise<UserRoleResponseDto | null>
}
