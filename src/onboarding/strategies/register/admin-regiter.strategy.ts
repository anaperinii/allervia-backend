import { Injectable } from "@nestjs/common";
import { UserInvite } from "src/onboarding/domain/entities/user-invite.entity";
import { PrismaService } from "src/database/prisma.service";
import { GrantRoleUseCase } from "src/account/use-cases/roles/grant-role.use-case";
import { RegisterStrategy } from "./register.strategy";
import { IUserInviteRepository } from "src/onboarding/domain/interfaces/user-invite.repository.interface";
import { RegisterUser } from "../../domain/interfaces/register.interface";
import { IPasswordHashingService } from "src/security/interfaces/password-hashing.service.interface";
import { User } from "src/account/domain/entities/user.entity";
import { IUserRepository } from "src/account/user.repository";
import { ProfileInternalUserDto } from "src/account/dtos/users/profile-internal-user.dto";

@Injectable()
export class AdminRegisterStrategy implements RegisterStrategy {
    constructor(
        private prisma: PrismaService,
        private userRepository: IUserRepository,
        private hashingService: IPasswordHashingService,
        private grantRoleUseCase: GrantRoleUseCase,
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

        await this.grantRoleUseCase.execute({ professionalId: savedUser.id, role: invite.roleType, grantedById: savedUser.id }, tx);

        return savedUser;
    });
    }
}