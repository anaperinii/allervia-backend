import { Injectable } from '@nestjs/common';
import { IUserRepository } from 'src/account/user.repository';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

@Injectable()
export class ValidateUserEmailUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(email: string, _currentUser: AuthenticatedUserPayload) {
    return this.userRepository.findUserByEmail(email);
  }
}
