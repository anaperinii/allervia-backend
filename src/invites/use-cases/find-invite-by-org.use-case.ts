import { Injectable } from "@nestjs/common";
import { IUserInviteRepository } from "src/invites/domain/interfaces/user-invite.repository.interface";
import { InviteResponseDto } from "src/invites/dtos/invite-response.dto";
import { FindInvitesFilters } from "src/invites/domain/interfaces/invite.interface";

@Injectable()
export class FindInviteByOrgUseCase {
    constructor(private inviteRepository: IUserInviteRepository) {}

    async execute(
        organizationId: string,
        filters: FindInvitesFilters = {}
    ): Promise<InviteResponseDto[]>  {
        return this.inviteRepository.findByOrganization(organizationId, filters);
    }
}