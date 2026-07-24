import { Injectable, NotFoundException } from "@nestjs/common";
import { IUserInviteRepository } from "../domain/interfaces/user-invite.repository.interface";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { INVITE_MESSAGES } from "../invite.messages";
import { UserInvite } from "../domain/entities/user-invite.entity";

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