import { Injectable } from '@nestjs/common';
import { IUserRepository } from '../../user.repository';
import { UpdateUserStatusDto } from '../../dtos/users/update-user-status.dto';
import { UserResponseDto } from '../../dtos/users/user-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { UserNotFoundException } from '../../exceptions/users/user-not-found.exception';

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

