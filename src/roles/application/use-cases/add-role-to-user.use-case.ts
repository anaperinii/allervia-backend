import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { FindUserRoleByNameUseCase } from './find-user-role-by-name.use-case';
import { FindRoleByNameUseCase } from './find-role-by-name.use-case';
import { InactiveRoleException } from 'src/roles/domain/exceptions/inactive-role.exception';
import { IRoleRepository } from 'src/roles/domain/contracts/role.repository.interface';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class AddRoleToUserUseCase {
  constructor(
    private findRoleByName: FindRoleByNameUseCase,
    private findUserRoleByName: FindUserRoleByNameUseCase,
    private roleRepository: IRoleRepository
  ) {}

  async execute(
    userId: string,
    roleName: RoleType,
    activeOrgId: string,
    tx?: ITransactionContext,
  ): Promise<void> {

    const role = await this.findRoleByName.execute(roleName, activeOrgId);

    if (!role.isActive) {
      throw new InactiveRoleException(role.name);
    }

    const existingRole = await this.findUserRoleByName.execute(userId, roleName);

    if(existingRole?.user!.organizationId !== activeOrgId) {
      throw new UnauthorizedException('User organization ID is not compatible to this action.');
    }

    if (existingRole) {
      throw new ConflictException(`User already has the role "${roleName}".`);
    }

    await this.roleRepository.createUserRole(userId, roleName, tx);
  }
}

