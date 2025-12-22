import { Injectable } from "@nestjs/common";
import { IUserRepository } from "src/account/domain/contracts/user.repository.interface";
import { UpdateUserAdminDto } from "../../../account/application/dtos/update-user-admin.dto";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { UserNotFoundException } from "src/account/domain/exceptions/user-not-found.exception";
import { IHashingService } from "src/account/domain/contracts/hashing.service.interface";
import { UserResponseDto } from "../../../account/application/dtos/user-response.dto";

@Injectable()
export class UpdateUserPersonalAdminUseCase {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly hashingService: IHashingService
    ) {}

    async execute(
        id: string,
        dto: UpdateUserAdminDto,
        currentUser: AuthenticatedUserPayload
    ): Promise<UserResponseDto> {
        const user = await this.userRepository.findUserById(id, currentUser.activeOrgId);

        if(!user) {
            throw new UserNotFoundException(id);
        }

        if (dto.fullName || dto.email) {
            user.updateProfile(dto.fullName, dto.email);
        }

        if (dto.password) {
            console.log(dto.password)
            const hashedPassword = await this.hashingService.hash(dto.password);
            console.log(hashedPassword)
            user.changePassword(hashedPassword);
        }

        const updatedUser = await this.userRepository.update(user);

        return updatedUser;
    }
}