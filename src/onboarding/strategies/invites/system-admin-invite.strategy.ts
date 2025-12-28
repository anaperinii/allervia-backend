import { Injectable } from "@nestjs/common";
import { InviteCreationStrategy } from "./invite-creation-strategy";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { CreateInviteDto } from "src/onboarding/dtos/create-invite.dto";

@Injectable()
export class SystemAdminInviteStrategy implements InviteCreationStrategy {

    async validateAndGetOrganizationId(dtoInvite: CreateInviteDto, currentUser: AuthenticatedUserPayload): Promise<string> {
        return currentUser.activeOrgId;
    }

}