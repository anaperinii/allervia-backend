import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RoleType, UserRole } from '@prisma/client';
import { CreateRoleProps, Role } from '../../domain/entities/role.entity';
import { IRoleRepository } from '../../domain/contracts/role.repository.interface';
import { UserRoleResponseDto } from 'src/roles/application/dtos/user-role-respose.dto';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class PrismaRoleRepository extends IRoleRepository {
  constructor(
    private readonly prismaService: PrismaService
  ) { super() }

  async create(
    role: CreateRoleProps,
    tx?:ITransactionContext
  ): Promise<Role> {
    const prismaClient = this.prismaService.getClient(tx);

    const created = await prismaClient.role.create({
      data: {
        name: role.name,
        description: role.description,
        organizationId: role.organizationId
      },
    });

    return new Role(created);
  }

  async createUserRole (
    userId: string,
    roleName: RoleType,
    tx?:ITransactionContext
  ) {
    const prismaClient = this.prismaService.getClient(tx);

    const userRole = await prismaClient.userRole.create({
      data: {
        userId,
        roleTag: roleName,
      },
    });

    return userRole;
  }

  async update(
    role: Role,
    tx?: ITransactionContext
  ): Promise<Role> {

    const prismaClient = this.prismaService.getClient(tx);

    const updated = await prismaClient.role.update({
      where: { id: role.id },
      data: {
        description: role.description,
        isActive: role.isActive,
        updatedAt: role.updatedAt,
      },
    });

    return new Role(updated);
  }

  async findById(
    id: string, 
    organizationId: string, 
    tx?: ITransactionContext
  ): Promise<Role | null> {

    const prismaClient = this.prismaService.getClient(tx);

    const prismaRole = await prismaClient.role.findUnique({
      where: { id, organizationId },
    });

    return prismaRole ? new Role(prismaRole) : null;
  }

  async findByName(
    name: RoleType, 
    organizationId: string,
    tx?: ITransactionContext
  ): Promise<Role | null> {

    const prismaClient = this.prismaService.getClient(tx);

    const prismaRole = await prismaClient.role.findUnique({
      where: { name, organizationId },
    });

    return prismaRole ? new Role(prismaRole) : null;
  }

  async findUserRoleByName(
    name: RoleType, 
    userId: string,
    tx?: ITransactionContext
  ): Promise<UserRoleResponseDto | null> {

    const prismaClient = this.prismaService.getClient(tx);

    const prismaUserRole = await prismaClient.userRole.findUnique({
      where: { userId_roleTag: { userId, roleTag: name } },
      include: { 
        user: { select: { organizationId: true }}
      }
    });

    return prismaUserRole;
  }

  async findAllActive(
    organizationId: string,
    tx?: ITransactionContext
  ): Promise<Role[]> {

    const prismaClient = this.prismaService.getClient(tx);

    const prismaRoles = await prismaClient.role.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });

    return prismaRoles.map(r => new Role(r));
  }

  async exists(
    id: string, 
    organizationId: string,
    tx?: ITransactionContext
  ): Promise<boolean> {

    const prismaClient = this.prismaService.getClient(tx);

    const count = await prismaClient.role.count({
      where: { id, organizationId },
    });

    return count > 0;
  }

  async hasActiveUserRoles(
    roleName: RoleType, 
    organizationId: string,
    tx?: ITransactionContext
  ): Promise<boolean> {

    const prismaClient = this.prismaService.getClient(tx);

    const count = await prismaClient.userRole.count({
      where: {
        roleTag: roleName,
        isActive: true,
        user: {
          organizationId
        }
      },
    });

    return count > 0;
  }

  async findRolesByUsers(
    roleName: RoleType,
    organizationId: string,
    tx?: ITransactionContext
  ): Promise<UserRoleResponseDto[]> {

    const prismaClient = this.prismaService.getClient(tx);

    const userRoles = await prismaClient.userRole.findMany({
      where: {
        roleTag: roleName,
        isActive: true,
        user: {
          organizationId
        }
      }
    });

    return userRoles;
  }
}

