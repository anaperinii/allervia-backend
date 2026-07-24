import { Injectable, NotFoundException } from '@nestjs/common';
import { IUserRepository } from '../../user.repository';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { USER_MESSAGES } from '../../user.messages';

@Injectable()
export class FindUserByIdUseCase {
  constructor(private roleRepository: IUserRepository) {}

  async execute(
    userId: string,
    _currentUser: AuthenticatedUserPayload
  ) {
    const user = await this.roleRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException(USER_MESSAGES.notFound(userId));
    }

    return user;
  }
}
