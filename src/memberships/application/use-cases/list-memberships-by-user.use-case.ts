import { Injectable } from "@nestjs/common";
import { IMembershipRepository } from "src/memberships/domain/contracts/membership.repository.interface";

@Injectable()
export class ListMembershipsByUserUseCase {
    constructor(private membershipsRepository: IMembershipRepository) {}

    async execute(userId: string) {
        const memberships = await this.membershipsRepository.findByUserId(userId);
        return memberships;
    }
}