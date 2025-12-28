import { Injectable } from "@nestjs/common";
import { UserInvite } from "src/onboarding/invite/domain/entities/user-invite.entity";
import { PrismaService } from "src/database/prisma/prisma.service";
import { AddRoleToUserUseCase } from "src/account/roles/application/use-cases/add-role-to-user.use-case";
import { IUserRepository } from "src/account/profiles/domain/contracts/user.repository.interface";
import { RegisterStrategy } from "./register.strategy";
import { User } from "src/account/profiles/domain/entities/user.entity";
import { IUserInviteRepository } from "src/onboarding/invite/domain/contracts/user-invite.repository.interface";
import { ProfileInternalUserDto } from "src/account/profiles/application/dtos/profile-internal-user.dto";
import { RegisterUser } from "../../domain/contracts/register.interface";
import { IPasswordHashingService } from "src/security/domain/contracts/password-hashing.service.interface";

@Injectable()
export class AdminRegisterStrategy implements RegisterStrategy {
    constructor(
        private prisma: PrismaService,
        private userRepository: IUserRepository,
        private hashingService: IPasswordHashingService,
        private addRoleToUserUseCase: AddRoleToUserUseCase,
        private inviteRepository: IUserInviteRepository
    ) {};
    
    async registerInternalUserFromInvite(
        invite: UserInvite, 
        dto: ProfileInternalUserDto
    ): Promise<RegisterUser> {

    return this.prisma.transaction(async (tx) => {
            
        const hashedPassword = await this.hashingService.hash(dto.password);
        
        const user = User.createNew({
            fullName: dto.fullName.trim(),
            email: invite.email.toLowerCase(),
            password: hashedPassword,
            type: 'ADMIN',
            organizationId: invite.organizationId,
            phoneNumber: dto.phoneNumber
        });
              
        const savedUser = await this.userRepository.create(user, tx);

        invite.markAsUsed();

        await this.inviteRepository.update(invite, tx);

        await this.addRoleToUserUseCase.execute(savedUser.id, invite.roleType, invite.organizationId, tx);

        return savedUser;
    });
    }
}