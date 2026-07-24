import { Injectable } from "@nestjs/common";
import { IUserInviteRepository } from "../domain/interfaces/user-invite.repository.interface";
import { InviteResponseDto } from "../dtos/invite-response.dto";
import { FindInvitesFilters } from "../domain/interfaces/invite.interface";

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