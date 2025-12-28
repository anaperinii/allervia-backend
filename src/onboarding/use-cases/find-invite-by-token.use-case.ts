import { Injectable } from "@nestjs/common";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { UserInviteNotFoundException } from "../domain/exceptions/user-invite-not-found.exception";
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
            throw new UserInviteNotFoundException(inviteToken);
        }

        return invite;
    }
}