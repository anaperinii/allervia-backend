import { Injectable } from '@nestjs/common';
import { IUserRepository } from '../../domain/contracts/user.repository.interface';
import { UpdateUserStatusDto } from '../dtos/update-user-status.dto';
import { UserResponseDto } from '../dtos/user-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { UserNotFoundException } from '../../domain/exceptions/user-not-found.exception';

@Injectable()
export class UpdateUserStatusUseCase {
  constructor(
    private readonly userRepository: IUserRepository
  ) {}

  async execute(
    id: string,
    dto: UpdateUserStatusDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findUserById(id, currentUser.activeOrgId);

    if (!user) {
      throw new UserNotFoundException(id);
    }

    if (dto.isActive) {
      user.activate();
    } else {
      user.deactivate();
      
    }

    const updatedUser = await this.userRepository.update(user);

    return updatedUser;
  }
}

