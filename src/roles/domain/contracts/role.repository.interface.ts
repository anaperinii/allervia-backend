import { UserRoleResponseDto } from 'src/roles/application/dtos/user-role-respose.dto';
import { CreateRoleProps, Role } from '../entities/role.entity';
import { RoleType, UserRole } from '@prisma/client';
import { ITransactionContext } from 'src/database/transaction.interface';

export abstract class IRoleRepository {
  abstract create(role: CreateRoleProps, tx?: ITransactionContext): Promise<Role>;

  abstract createUserRole(userId: string, roleName: RoleType, tx?: ITransactionContext): Promise<UserRole>;

  abstract update(role: Role, tx?: ITransactionContext): Promise<Role>;

  abstract findById(
    id: string,
    organizationId: string
  ): Promise<Role | null>;

  abstract findByName(
    name: RoleType,
    organizationId: string
  ): Promise<Role | null>;

  abstract findAllActive(
    organizationId: string
  ): Promise<Role[]>;

  abstract exists(
    id: string,
    organizationId: string
  ): Promise<boolean>;

  abstract hasActiveUserRoles(
    roleName: RoleType,
    organizationId: string
  ): Promise<boolean>;

  abstract findRolesByUsers(
    roleName: RoleType,
    organizationId: string
  ): Promise<UserRoleResponseDto[]>;

  abstract findUserRoleByName(
    roleName: RoleType,
    userId: string
  ): Promise<UserRoleResponseDto | null>
}
