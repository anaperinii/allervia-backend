import { Injectable, NotFoundException } from '@nestjs/common';
import { IUserRepository } from '../user.repository';
import { UpdateUserStatusDto } from '../dtos/update-user-status.dto';
import { UserResponseDto } from '../dtos/user-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { USER_MESSAGES } from '../user.messages';

@Injectable()
export class UpdateUserStatusUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(
    id: string,
    dto: UpdateUserStatusDto,
    _currentUser: AuthenticatedUserPayload,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findUserById(id);

    if (!user) {
      throw new NotFoundException(USER_MESSAGES.notFound(id));
    }

    return this.userRepository.update({ id, isActive: dto.isActive });
  }
}
