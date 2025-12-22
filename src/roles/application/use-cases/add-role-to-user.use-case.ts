import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FindUserByIdUseCase } from 'src/account/application/use-cases/find-user-by-id.use-case';
import { FindUserRoleByNameUseCase } from './find-user-role-by-name.use-case';
import { FindRoleByNameUseCase } from './find-role-by-name.use-case';
import { InactiveRoleException } from 'src/roles/domain/exceptions/inactive-role.exception';

@Injectable()
export class AddRoleToUserUseCase {
  constructor(
    private findUserByIdUseCase: FindUserByIdUseCase,
    private findRoleByName: FindRoleByNameUseCase,
    private findUserRoleByName: FindUserRoleByNameUseCase,
    private prisma: PrismaService
  ) {}

  async execute(
    userId: string,
    roleName: RoleType,
    activeOrgId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {

    const prismaClient = tx || this.prisma;

    const targetUser = await this.findUserByIdUseCase.execute(userId, undefined, activeOrgId, tx);

    const role = await this.findRoleByName.execute(roleName, activeOrgId, tx);

    if (!role.isActive) {
      throw new InactiveRoleException(role.name);
    }

    const existingRole = await this.findUserRoleByName.execute(userId, roleName, tx);

    if (existingRole) {
      throw new ConflictException(`User already has the role "${roleName}".`);
    }

    await prismaClient.userRole.create({
      data: {
        userId: targetUser.id,
        roleTag: roleName,
      },
    });
  }
}

