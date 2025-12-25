import { ProfileInternalUserDto } from "src/account/application/dtos/profile-internal-user.dto";
import { UserInvite } from "src/onboarding/invite/domain/entities/user-invite.entity";
import { RegisterUser } from "../../domain/interfaces/register.interface";

export interface RegisterStrategy {
    registerInternalUserFromInvite(
        invite: UserInvite, 
        dto: ProfileInternalUserDto
    ): Promise<RegisterUser>;
}