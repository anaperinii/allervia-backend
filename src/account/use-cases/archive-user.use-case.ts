import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { IUserRepository } from 'src/account/user.repository';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { USER_MESSAGES } from '../user.messages';

@Injectable()
export class ArchiveUserUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(
    id: string,
    _currentUser: AuthenticatedUserPayload,
  ): Promise<User> {
    const user = await this.userRepository.findUserById(id);

    if (!user) {
      throw new NotFoundException(USER_MESSAGES.notFound(id));
    }

    return this.userRepository.update({
      id,
      isArchived: true,
      isActive: false,
    });
  }
}
