import { BadRequestException, Injectable } from "@nestjs/common";
import { UserInviteAlreadyUsedException } from "../domain/exceptions/user-invite-already-used.exception";
import { UserInviteExpiredException } from "../domain/exceptions/user-invite-expired.exception";
import { FindInviteByTokenUseCase } from "./find-invite-by-token.use-case";
import { UserInviteCancelledException } from "../domain/exceptions/user-invite-cancelled.exception";

@Injectable()
export class ValidateInviteForRegisterUseCase {
    constructor(
        private findInviteByToken: FindInviteByTokenUseCase
    ) {}

    async execute(token: string) {
        const invite = await this.findInviteByToken.execute(token);
        
        try {
            invite.validateForUse();
        } catch (error) {
            if (error instanceof UserInviteAlreadyUsedException) {
                throw new BadRequestException('Convite já foi utilizado');
            }
            if (error instanceof UserInviteExpiredException) {
                throw new BadRequestException('Convite expirado');
            }
            if (error instanceof UserInviteCancelledException) {
                throw new BadRequestException('Convite cancelado');
            }
            throw error;
        }
        
        return invite;
    }
}