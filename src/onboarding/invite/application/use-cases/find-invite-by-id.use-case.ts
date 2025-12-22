import { Injectable } from "@nestjs/common";
import { IUserInviteRepository } from "../../domain/contracts/user-invite.repository.interface";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { UserInviteNotFoundException } from "../../domain/exceptions/user-invite-not-found.exception";
import { UserInvite } from "../../domain/entities/user-invite.entity";

@Injectable()
export class FindInviteByIdUseCase {
    constructor(private inviteRepository: IUserInviteRepository) {}

    async execute(inviteId: string, currentUser: AuthenticatedUserPayload): Promise<UserInvite> {
        const invite = await this.inviteRepository.findById(inviteId, currentUser);

        if(!invite) {
            throw new UserInviteNotFoundException(inviteId);
        }

        return invite;
    }
}