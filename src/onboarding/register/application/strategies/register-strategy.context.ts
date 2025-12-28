import { Injectable } from "@nestjs/common";
import { RegisterStrategy } from "./register.strategy";
import { RoleType } from "@prisma/client";
import { RegisterStrategyFactory } from "./register-strategy.factory";
import { ProfileInternalUserDto } from "src/account/profiles/application/dtos/profile-internal-user.dto";
import { ValidateInviteForRegisterUseCase } from "src/onboarding/invite/application/use-cases/validate-invite-for-registration.use-case";
import { RegisterUser } from "../../domain/contracts/register.interface";

@Injectable()
export class RegisterStrategyContext{
    private strategy: RegisterStrategy;

    constructor(
        private registerFactory: RegisterStrategyFactory,
        private validateInviteForRegistration: ValidateInviteForRegisterUseCase
    ) {};

    private setStrategyForUser(roleType: RoleType) {
        this.strategy = this.registerFactory.getStrategy(roleType);
    }

    async registerInternalUserFromInvite(inviteToken: string, dto: ProfileInternalUserDto): Promise<RegisterUser> {
        const invite = await this.validateInviteForRegistration.execute(inviteToken);

        this.setStrategyForUser(invite.roleType);

        if (!this.strategy) {
            throw new Error('Strategy not set.');
        }

        return this.strategy.registerInternalUserFromInvite(invite, dto);
    }
}