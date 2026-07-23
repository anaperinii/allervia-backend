import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { INVITE_MESSAGES } from "../invite.messages";
import { IUserInviteRepository } from "../domain/interfaces/user-invite.repository.interface";
import { UserInvite } from "../domain/entities/user-invite.entity";

@Injectable()
export class FindInviteByTokenUseCase {
    constructor(private inviteRepository: IUserInviteRepository) {}

    async execute(
        inviteToken: string
    ): Promise<UserInvite> {
        const invite = await this.inviteRepository.findByToken(inviteToken);

        if(!invite) {
            throw new NotFoundException(INVITE_MESSAGES.notFound(inviteToken));
        }

        return invite;
    }
}