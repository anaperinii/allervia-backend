import { Injectable } from "@nestjs/common";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { CreateInviteDto } from "src/onboarding/dtos/create-invite.dto";
import { InviteCreationStrategy } from "./invite-creation-strategy";

@Injectable()
export class AdminInviteStrategy implements InviteCreationStrategy {

    async validateAndGetOrganizationId(dtoInvite: CreateInviteDto, currentUser: AuthenticatedUserPayload): Promise<string> {
        return currentUser.activeOrgId;
    }

}