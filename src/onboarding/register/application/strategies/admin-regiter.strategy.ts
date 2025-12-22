import { Injectable } from "@nestjs/common";
import { RegisterResult } from "../../domain/interfaces/register.interface";
import { UserInvite } from "src/onboarding/invite/domain/entities/user-invite.entity";
import { PrismaService } from "src/prisma/prisma.service";
import { AddRoleToUserUseCase } from "src/roles/application/use-cases/add-role-to-user.use-case";
import { IUserRepository } from "src/account/domain/contracts/user.repository.interface";
import { IHashingService } from "src/account/domain/contracts/hashing.service.interface";
import { RegisterStrategy } from "./register.strategy";
import { User } from "src/account/domain/entities/user.entity";
import { IUserInviteRepository } from "src/onboarding/invite/domain/contracts/user-invite.repository.interface";
import { ProfileInternalUserDto } from "src/account/application/dtos/profile-internal-user.dto";

@Injectable()
export class AdminRegisterStrategy implements RegisterStrategy {
    constructor(
        private prisma: PrismaService,
        private userRepository: IUserRepository,
        private hashingService: IHashingService,
        private addRoleToUserUseCase: AddRoleToUserUseCase,
        private inviteRepository: IUserInviteRepository
    ) {};
    
    async registerInternalUserFromInvite(
        invite: UserInvite, 
        dto: ProfileInternalUserDto
    ): Promise<RegisterResult> {

    return this.prisma.$transaction(async (tx) => {
            
        const hashedPassword = await this.hashingService.hash(dto.password);
        
        const user = User.createNew({
          fullName: dto.fullName.trim(),
          email: invite.email.toLowerCase(),
          password: hashedPassword,
          type: 'ADMIN',
          organizationId: invite.organizationId,
        });
              
        const savedUser = await this.userRepository.create(user, tx);

        invite.markAsUsed();

        await this.inviteRepository.update(invite, tx);

        await this.addRoleToUserUseCase.execute(savedUser.id, invite.roleType, invite.organizationId, tx);

        return {
            user: { id: savedUser.id, email: savedUser.email, fullName: savedUser.fullName }
        };
    });
    }
}