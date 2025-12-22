import { Injectable } from "@nestjs/common";
import { IUserRepository } from "src/account/domain/contracts/user.repository.interface";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";

@Injectable()
export class ValidateUserEmailUseCase {
    constructor(private userRepository: IUserRepository) {}

    async execute(email: string, currentUser: AuthenticatedUserPayload) {
        const user = await this.userRepository.findUserByEmail(email, currentUser);
        return user;
    }
}