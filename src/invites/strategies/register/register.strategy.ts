import { UserInvite } from "src/invites/domain/entities/user-invite.entity";
import { RegisterUser } from "../../domain/interfaces/register.interface";
import { ProfileInternalUserDto } from "src/account/dtos/profile-internal-user.dto";

export interface RegisterStrategy {
    registerInternalUserFromInvite(
        invite: UserInvite, 
        dto: ProfileInternalUserDto
    ): Promise<RegisterUser>;
}