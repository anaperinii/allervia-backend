import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IUserRepository } from 'src/account/user.repository';
import { IPasswordHashingService } from 'src/security/interfaces/password-hashing.service.interface';
import { CreateProfessionalUseCase } from 'src/professionals/use-cases/create-professional.use-case';
import { ProfessionalRepository } from 'src/professionals/professional.repository';
import { GrantRoleUseCase } from 'src/security/permissions/use-cases/grant-role.use-case';
import { IUserInviteRepository } from 'src/invites/domain/interfaces/user-invite.repository.interface';
import { UserInvite } from 'src/invites/domain/entities/user-invite.entity';
import { ProfileInternalUserDto } from 'src/account/dtos/profile-internal-user.dto';
import { RegisterUser } from 'src/invites/domain/interfaces/register.interface';
import { RegisterStrategy } from './register.strategy';

@Injectable()
export class InternalUserRegisterStrategy implements RegisterStrategy {
  constructor(
    private prisma: PrismaService,
    private userRepository: IUserRepository,
    private hashingService: IPasswordHashingService,
    private createProfessional: CreateProfessionalUseCase,
    private professionalRepository: ProfessionalRepository,
    private grantRole: GrantRoleUseCase,
    private inviteRepository: IUserInviteRepository,
  ) {}

  async registerInternalUserFromInvite(
    invite: UserInvite,
    dto: ProfileInternalUserDto,
  ): Promise<RegisterUser> {
    return this.prisma.$transaction(async (tx) => {
      const hashedPassword = await this.hashingService.hash(dto.password);

      const user = await this.userRepository.create(
        {
          email: invite.email.toLowerCase(),
          password: hashedPassword,
          type: 'PROFESSIONAL',
          createdById: invite.createdById,
        },
        tx,
      );

      const professional = await this.createProfessional.execute(
        {
          userId: user.id,
          organizationId: invite.organizationId,
          fullName: dto.fullName.trim(),
          phoneNumber: dto.phoneNumber,
          profession: dto.profession,
        },
        tx,
      );

      const inviter = await this.professionalRepository.findByUserId(
        invite.createdById,
        tx,
      );

      await this.grantRole.execute(
        {
          professionalId: professional.id,
          role: invite.role,
          grantedById: inviter?.id ?? professional.id,
        },
        tx,
      );

      invite.markAsUsed();
      await this.inviteRepository.update(invite, tx);

      return {
        userId: user.id,
        professionalId: professional.id,
        email: user.email,
        fullName: professional.fullName,
        phoneNumber: professional.phoneNumber,
        profession: professional.profession,
      };
    });
  }
}
