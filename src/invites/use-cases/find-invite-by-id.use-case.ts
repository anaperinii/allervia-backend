import { Injectable, NotFoundException } from "@nestjs/common";
import { IUserInviteRepository } from "src/invites/domain/interfaces/user-invite.repository.interface";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { INVITE_MESSAGES } from "src/invites/invite.messages";
import { UserInvite } from "src/invites/domain/entities/user-invite.entity";

@Injectable()
export class FindInviteByIdUseCase {
    constructor(private inviteRepository: IUserInviteRepository) {}

    async execute(inviteId: string, currentUser: AuthenticatedUserPayload): Promise<UserInvite> {
        const invite = await this.inviteRepository.findById(inviteId, currentUser);

        if(!invite) {
            throw new NotFoundException(INVITE_MESSAGES.notFound(inviteId));
        }

        return invite;
    }
}