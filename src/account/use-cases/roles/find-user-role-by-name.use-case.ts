import { Injectable } from "@nestjs/common";
import { RoleType } from "@prisma/client";
import { IRoleRepository } from "src/account/role.repository";
import { UserRoleResponseDto } from "../../dtos/roles/user-role-respose.dto";

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