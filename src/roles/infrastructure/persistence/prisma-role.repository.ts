import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, RoleType, UserRole } from '@prisma/client';
import { CreateRoleProps, Role } from '../../domain/entities/role.entity';
import { IRoleRepository } from '../../domain/repositories/role.repository.interface';
import { UserRoleResponseDto } from 'src/roles/application/dtos/user-role-respose.dto';

@Injectable()
export class PrismaRoleRepository extends IRoleRepository {
  constructor(
    private readonly prismaService: PrismaService
  ) {
    super();
  }

  async create(
    role: CreateRoleProps,
    tx?: Prisma.TransactionClient
  ): Promise<Role> {
    const prismaClient = tx || this.prismaService;

    const created = await prismaClient.role.create({
      data: {
        name: role.name,
        description: role.description,
        organizationId: role.organizationId
      },
    });

    return new Role(created);
  }

  async update(
    role: Role,
    tx?: Prisma.TransactionClient
  ): Promise<Role> {

    const prismaClient = tx || this.prismaService;

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
    tx?: Prisma.TransactionClient
  ): Promise<Role | null> {

    const prismaClient = tx || this.prismaService;

    const prismaRole = await prismaClient.role.findUnique({
      where: { id, organizationId },
    });

    return prismaRole ? new Role(prismaRole) : null;
  }

  async findByName(
    name: RoleType, 
    organizationId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Role | null> {

    const prismaClient = tx || this.prismaService;

    const prismaRole = await prismaClient.role.findUnique({
      where: { name, organizationId },
    });

    return prismaRole ? new Role(prismaRole) : null;
  }

  async findUserRoleByName(
    name: RoleType, 
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<UserRoleResponseDto | null> {

    const prismaClient = tx || this.prismaService;

    const prismaUserRole = await prismaClient.userRole.findUnique({
      where: { userId_roleTag: { userId, roleTag: name } },
    });

    return prismaUserRole;
  }

  async findAllActive(
    organizationId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Role[]> {

    const prismaClient = tx || this.prismaService;

    const prismaRoles = await prismaClient.role.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });

    return prismaRoles.map(r => new Role(r));
  }

  async exists(
    id: string, 
    organizationId: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean> {

    const prismaClient = tx || this.prismaService;

    const count = await prismaClient.role.count({
      where: { id, organizationId },
    });

    return count > 0;
  }

  async hasActiveUserRoles(
    roleName: RoleType, 
    organizationId: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean> {

    const prismaClient = tx || this.prismaService;

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
    tx?: Prisma.TransactionClient
  ): Promise<UserRoleResponseDto[]> {

    const prismaClient = tx || this.prismaService;

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

