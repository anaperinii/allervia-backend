import { Injectable } from "@nestjs/common";
import { Prisma, RoleType } from "@prisma/client";
import { RoleNotFoundException } from "src/account/roles/domain/exceptions/role-not-found.exception";
import { IRoleRepository } from "src/account/roles/domain/contracts/role.repository.interface";

@Injectable()
export class FindRoleByNameUseCase {
    constructor(
        private roleRepository: IRoleRepository
    ) {}

    async execute(
        name: RoleType, 
        organizationId: string
    ) {
        const role = await this.roleRepository.findByName(name, organizationId);

        if(!role) {
            throw new RoleNotFoundException(name);
        }

        return role;
    }
}