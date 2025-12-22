import { Injectable, NotFoundException } from '@nestjs/common';
import { IUserRepository } from '../../../account/domain/contracts/user.repository.interface';
import { UserResponseDto } from '../../../account/application/dtos/user-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { UserNotFoundException } from '../../../account/domain/exceptions/user-not-found.exception';
import { IHashingService } from '../../../account/domain/contracts/hashing.service.interface';
import { UpdateUserPersonalDto } from '../../../account/application/dtos/update-user-personal.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { IProfessionalRepository } from 'src/professionals/domain/professional.repository.interface';

@Injectable()
export class UpdateUserPersonalUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashingService: IHashingService,
    private professionalRepository: IProfessionalRepository,
    private prisma: PrismaService
  ) {}

  async execute(
    id: string,
    dto: UpdateUserPersonalDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<UserResponseDto> {

    return await this.prisma.$transaction(async (tx) => {
      const user = await this.userRepository.findUserById(id, currentUser.activeOrgId, tx);

      if (!user) {
        throw new UserNotFoundException(id);
      }

      const professional = await this.professionalRepository.findProfessionalByUserId(user.id);
      
      if(!professional) {
        throw new NotFoundException('Não há registro de um usuário do tipo Profissional com este ID');
      }

      if (dto.fullName) {
        user.updateProfile(dto.fullName);
      }

      if (dto.password) {
        const hashedPassword = await this.hashingService.hash(dto.password);
        user.changePassword(hashedPassword);
      }

      if(dto.phoneNumber || dto.specialty) {
        professional.update(dto.specialty, dto.phoneNumber);   
      }

      const updatedUserProfessional = await this.professionalRepository.update(professional, tx);

      const updatedUser = await this.userRepository.update(user, tx);

      const responseData = {
          ...updatedUser,
          professional: {
              ...updatedUserProfessional
          }
      };

      return responseData;
    });
  }
}
