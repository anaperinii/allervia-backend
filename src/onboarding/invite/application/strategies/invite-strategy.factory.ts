import { BadRequestException, Injectable } from "@nestjs/common";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { InviteCreationStrategy } from "./invite-creation-strategy";
import { AdminInviteStrategy } from "./admin-invite.strategy";
import { SystemAdminInviteStrategy } from "./system-admin-invite.strategy";

@Injectable()
export class InviteStrategyFactory {
    constructor(
        private adminStrategy: AdminInviteStrategy,
        private systemAdminStrategy: SystemAdminInviteStrategy
    ) {}

    getStrategy(currentUser: AuthenticatedUserPayload): InviteCreationStrategy {
        if(currentUser.type === 'ADMIN') {
            return this.adminStrategy;
        }

        if(currentUser.type === 'SYSTEM_ADMIN') {
            return this.systemAdminStrategy;
        }

        throw new BadRequestException('Tipo de usuário não autorizado para gerar convites');
    }
}