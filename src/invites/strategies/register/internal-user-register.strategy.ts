import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { INVITE_MESSAGES } from 'src/invites/invite.messages';
import { UserInviteAlreadyUsedException } from 'src/invites/domain/exceptions/user-invite-already-used.exception';
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
    const hashedPassword = await this.hashingService.hash(dto.password);

    try {
      return await this.register(invite, dto, hashedPassword);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(INVITE_MESSAGES.emailAlreadyActive);
      }

      throw error;
    }
  }

  private async register(
    invite: UserInvite,
    dto: ProfileInternalUserDto,
    hashedPassword: string,
  ): Promise<RegisterUser> {
    return this.prisma.$transaction(async (tx) => {
      invite.markAsUsed();

      const consumed = await this.inviteRepository.markAsUsed(
        invite.id,
        invite.usedAt!,
        tx,
      );

      if (!consumed) {
        throw new UserInviteAlreadyUsedException();
      }

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
          actorUserId: invite.createdById,
          organizationId: invite.organizationId,
        },
        tx,
      );

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
