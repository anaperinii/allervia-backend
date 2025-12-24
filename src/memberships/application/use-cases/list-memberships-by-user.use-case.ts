import { Injectable } from "@nestjs/common";
import { NoMembershipsForUserException } from "src/memberships/domain/exceptions/no-memberships-for-user.exception";
import { IMembershipRepository } from "src/memberships/domain/contracts/membership.repository.interface";

@Injectable()
export class ListMembershipsByUserUseCase {
    constructor(private membershipsRepository: IMembershipRepository) {}

    async execute(userId: string) {
        const memberships = await this.membershipsRepository.findByUserId(userId);

        return memberships;
    }
}