import { Injectable } from "@nestjs/common";
import { Prisma, RoleType } from "@prisma/client";
import { RoleNotFoundException } from "src/roles/domain/exceptions/role-not-found.exception";
import { IRoleRepository } from "src/roles/domain/repositories/role.repository.interface";

@Injectable()
export class FindRoleByNameUseCase {
    constructor(
        private roleRepository: IRoleRepository
    ) {}

    async execute(
        name: RoleType, 
        organizationId: string,
        tx?: Prisma.TransactionClient
    ) {
        const role = await this.roleRepository.findByName(name, organizationId, tx);

        if(!role) {
            throw new RoleNotFoundException(name);
        }

        return role;
    }
}