import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { CreateInviteDto } from "src/onboarding/dtos/create-invite.dto";

export interface InviteCreationStrategy {
    validateAndGetOrganizationId(
        dto: CreateInviteDto,
        currentUser: AuthenticatedUserPayload
    ): Promise<string>;
}