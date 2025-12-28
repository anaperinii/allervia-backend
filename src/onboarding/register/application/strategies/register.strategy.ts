import { ProfileInternalUserDto } from "src/account/profiles/application/dtos/profile-internal-user.dto";
import { UserInvite } from "src/onboarding/invite/domain/entities/user-invite.entity";
import { RegisterUser } from "../../domain/contracts/register.interface";

export interface RegisterStrategy {
    registerInternalUserFromInvite(
        invite: UserInvite, 
        dto: ProfileInternalUserDto
    ): Promise<RegisterUser>;
}