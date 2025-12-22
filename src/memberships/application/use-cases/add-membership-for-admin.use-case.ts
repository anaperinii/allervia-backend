import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Membership } from "src/memberships/domain/entities/membership.entity";
import { IMembershipRepository } from "src/memberships/domain/contracts/membership.repository.interface";
import { FindOrganizationUseCase } from "src/organizations/application/use-cases/find-organization.use-case";

@Injectable()
export class AddMembershipForAdminUseCase {
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
            throw new ConflictException('Membership já existe');
        }
        
        await this.findOrganizationUseCase.execute(orgId);

        const membership = Membership.createNew({
            userId: userId,
            organizationId: orgId
        });
        
        return await this.membershipRepository.create(membership);
    }
}