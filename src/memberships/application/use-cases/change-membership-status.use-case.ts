import { Injectable } from "@nestjs/common";
import { NoMembershipsForUserException } from "src/memberships/domain/exceptions/no-memberships-for-user.exception";
import { IMembershipRepository } from "src/memberships/domain/contracts/membership.repository.interface";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";

@Injectable()
export class ChangeMembershipStatusUseCase {
    constructor(private membershipRepository: IMembershipRepository) {}

    async execute (currentUser: AuthenticatedUserPayload, orgId: string) {
        const membership = await this.membershipRepository.findByUserAndOrganization(currentUser.id, orgId);

        if (!membership) {
            throw new NoMembershipsForUserException(currentUser.id);
        }

        if (membership.isActive) {
            membership.deactivate();
        } else {
            membership.activate();
        }

        const cancelledMembership = await this.membershipRepository.update(membership);

        return cancelledMembership;
    }
}