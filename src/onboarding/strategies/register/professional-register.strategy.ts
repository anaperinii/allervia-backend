import { Injectable } from "@nestjs/common";
import { RegisterStrategy } from "./register.strategy";
import { UserInvite } from "src/onboarding/domain/entities/user-invite.entity";
import { PrismaService } from "src/database/prisma.service";
import { AddRoleToUserUseCase } from "src/account/use-cases/roles/add-role-to-user.use-case";
import { IUserInviteRepository } from "src/onboarding/domain/interfaces/user-invite.repository.interface";
import { RegisterUser } from "../../domain/interfaces/register.interface";
import { IPasswordHashingService } from "src/security/interfaces/password-hashing.service.interface";
import { User } from "src/account/domain/entities/user.entity";
import { IUserRepository } from "src/account/domain/interfaces/user.repository.interface";
import { ProfileInternalUserDto } from "src/account/dtos/users/profile-internal-user.dto";


@Injectable()
export class ProfessionalRegisterStrategy implements RegisterStrategy {
    constructor(
      private prisma: PrismaService,
      private hashingService: IPasswordHashingService,
      private addRoleToUserUseCase: AddRoleToUserUseCase,
      private userRepository: IUserRepository, 
      private inviteRepository: IUserInviteRepository
    ) {};

    async registerInternalUserFromInvite(invite: UserInvite, dto: ProfileInternalUserDto): Promise<RegisterUser> {

      return this.prisma.transaction(async (tx) => {
      
        const hashedPassword = await this.hashingService.hash(dto.password);
        
        const user = User.createNew({
          fullName: dto.fullName.trim(),
          email: invite.email.toLowerCase(),
          password: hashedPassword,
          type: 'PROFESSIONAL',
          organizationId: invite.organizationId,
          specialty: dto.specialty!,
          phoneNumber: dto.phoneNumber
        });
        
        const savedUser = await this.userRepository.create(user, tx);
        
        invite.markAsUsed();
        invite.includeProfessional(savedUser.id);

        await this.inviteRepository.update(invite, tx);
        
        await this.addRoleToUserUseCase.execute(savedUser.id, invite.roleType, invite.organizationId, tx);
        
        return savedUser;
      });
    }
}