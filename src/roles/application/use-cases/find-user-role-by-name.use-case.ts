import { Injectable } from "@nestjs/common";
import { Prisma, RoleType, UserRole } from "@prisma/client";
import { IRoleRepository } from "src/roles/domain/contracts/role.repository.interface";
import { UserRoleResponseDto } from "../dtos/user-role-respose.dto";

@Injectable()
export class FindUserRoleByNameUseCase {
    constructor(private roleRepository: IRoleRepository) {}

    async execute(
        userId: string,
        roleName: RoleType
    ): Promise<UserRoleResponseDto | null> {

        const userRole = await this.roleRepository.findUserRoleByName(roleName, userId);

        return userRole;
    }
}