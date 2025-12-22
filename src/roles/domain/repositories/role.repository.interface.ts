import { UserRoleResponseDto } from 'src/roles/application/dtos/user-role-respose.dto';
import { CreateRoleProps, Role } from '../entities/role.entity';
import { Prisma, RoleType, UserRole } from '@prisma/client';

export abstract class IRoleRepository {
  abstract create(role: CreateRoleProps, tx?: Prisma.TransactionClient): Promise<Role>;

  abstract update(role: Role, tx?: Prisma.TransactionClient): Promise<Role>;

  abstract findById(
    id: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Role | null>;

  abstract findByName(
    name: RoleType,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Role | null>;

  abstract findAllActive(
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Role[]>;

  abstract exists(
    id: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean>;

  abstract hasActiveUserRoles(
    roleName: RoleType,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean>;

  abstract findRolesByUsers(
    roleName: RoleType,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<UserRoleResponseDto[]>;

  abstract findUserRoleByName(
    roleName: RoleType,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<UserRoleResponseDto | null>
}
