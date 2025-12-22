import { Injectable } from "@nestjs/common";
import { RegisterStrategy } from "./register.strategy";
import { RegisterResult } from "../../domain/interfaces/register.interface";
import { UserInvite } from "src/onboarding/invite/domain/entities/user-invite.entity";
import { PrismaService } from "src/prisma/prisma.service";
import { AddRoleToUserUseCase } from "src/roles/application/use-cases/add-role-to-user.use-case";
import { IHashingService } from "src/account/domain/contracts/hashing.service.interface";
import { User } from "src/account/domain/entities/user.entity";
import { ProfileInternalUserDto } from "src/account/application/dtos/profile-internal-user.dto";
import { IUserRepository } from "src/account/domain/contracts/user.repository.interface";
import { IUserInviteRepository } from "src/onboarding/invite/domain/contracts/user-invite.repository.interface";
import { Professional } from "src/professionals/domain/entities/professional.entity";
import { IProfessionalRepository } from "src/professionals/domain/professional.repository.interface";


@Injectable()
export class ProfessionalRegisterStrategy implements RegisterStrategy {
    constructor(
      private prisma: PrismaService,
      private hashingService: IHashingService,
      private addRoleToUserUseCase: AddRoleToUserUseCase,
      private userRepository: IUserRepository, 
      private inviteRepository: IUserInviteRepository,
      private professionalRepository: IProfessionalRepository
    ) {};

    async registerInternalUserFromInvite(invite: UserInvite, dto: ProfileInternalUserDto): Promise<RegisterResult> {
      return this.prisma.$transaction(async (tx) => {
      
      const hashedPassword = await this.hashingService.hash(dto.password);
      
      const user = User.createNew({
        fullName: dto.fullName.trim(),
        email: invite.email.toLowerCase(),
        password: hashedPassword,
        type: 'PROFESSIONAL',
        organizationId: invite.organizationId
      });
      
      const savedUser = await this.userRepository.create(user, tx);

      const professional = Professional.createNew({
        specialty: dto.specialty!,
        phoneNumber: dto.phoneNumber!,
        userId: savedUser.id
      });

      const savedProfessional = await this.professionalRepository.create(professional, tx);
      
      invite.markAsUsed();
      invite.includeProfessional(savedProfessional.id);

      await this.inviteRepository.update(invite, tx);
      
      await this.addRoleToUserUseCase.execute(savedUser.id, invite.roleType, invite.organizationId, tx);
      
      return {
        user: { id: savedUser.id, email: savedUser.email, fullName: savedUser.fullName },
        savedProfessional,
        };
      });
    }
}