import { Injectable } from '@nestjs/common';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { UserResponseDto } from '../../dtos/users/user-response.dto';
import { IUserRepository } from 'src/account/user.repository';

@Injectable()
export class FindAllUsersByOrganizationUseCase {
  constructor(
    private readonly userRepository: IUserRepository
  ) {}

  async execute(currentUser: AuthenticatedUserPayload): Promise<UserResponseDto[]> {
    const users = await this.userRepository.findAllUsersByOrg(currentUser.activeOrgId);  
    return users;
  }
}

