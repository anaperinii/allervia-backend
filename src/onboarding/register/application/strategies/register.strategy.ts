import { ProfileInternalUserDto } from "src/account/application/dtos/profile-internal-user.dto";
import { RegisterResult } from "../../domain/interfaces/register.interface";
import { UserInvite } from "src/onboarding/invite/domain/entities/user-invite.entity";

export interface RegisterStrategy {
    registerInternalUserFromInvite(
        invite: UserInvite, 
        dto: ProfileInternalUserDto
    ): Promise<RegisterResult>;
}