import { ConflictException, Injectable } from "@nestjs/common";
import { Membership } from "src/memberships/domain/entities/membership.entity";
import { IMembershipRepository } from "src/memberships/domain/contracts/membership.repository.interface";
import { FindOrganizationUseCase } from "src/organizations/application/use-cases/find-organization.use-case";
import { MembershipAlreadyExistsException } from "src/memberships/domain/exceptions/membership-already-exists.exception";

@Injectable()
export class AddMembershipForSystemAdminUseCase {
    constructor(
        private membershipRepository: IMembershipRepository,
        private findOrganizationUseCase: FindOrganizationUseCase
    ) {}

    async execute(
        orgId: string, 
        userId: string
    ) {
        const existing = await this.membershipRepository.findByUserId(userId);
        
        if (existing) {
            throw new MembershipAlreadyExistsException(userId, orgId);
        }
        
        await this.findOrganizationUseCase.execute(orgId);

        const membership = Membership.createNew({
            userId: userId,
            organizationId: orgId
        });
        
        return await this.membershipRepository.create(membership);
    }
}