import { Injectable } from "@nestjs/common";
import { Prisma, RoleType, UserRole } from "@prisma/client";
import { IRoleRepository } from "src/roles/domain/repositories/role.repository.interface";

@Injectable()
export class FindUserRoleByNameUseCase {
    constructor(private roleRepository: IRoleRepository) {}

    async execute(
        userId: string,
        roleName: RoleType,
        tx?: Prisma.TransactionClient
    ): Promise<UserRole | null> {

        const userRole = await this.roleRepository.findUserRoleByName(roleName, userId, tx);

        return userRole;
    }
}