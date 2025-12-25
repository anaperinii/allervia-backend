import { Injectable, NotFoundException } from '@nestjs/common';
import { IUserRepository } from '../../domain/contracts/user.repository.interface';
import { UserResponseDto } from '../dtos/user-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { UserNotFoundException } from '../../domain/exceptions/user-not-found.exception';
import { IHashingService } from '../../domain/contracts/hashing.service.interface';
import { UpdateUserDto } from '../dtos/update-user.dto';

@Injectable()
export class UpdateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashingService: IHashingService,
  ) {}

  async execute(
    id: string,
    dto: UpdateUserDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<UserResponseDto> {
      
      const user = await this.userRepository.findUserById(id, currentUser.activeOrgId);

      if (!user) {
        throw new UserNotFoundException(id);
      }

      if (dto.fullName || dto.phoneNumber || dto.specialty) {
          user.updateProfile(dto.fullName, dto.specialty, dto.phoneNumber);
      }

      if (dto.password) {
        const hashedPassword = await this.hashingService.hash(dto.password);
        user.updatePassword(hashedPassword);
      }

      const updatedUser = await this.userRepository.update(user);

      return updatedUser;

  }
}
