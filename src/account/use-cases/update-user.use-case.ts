import { Injectable, NotFoundException } from '@nestjs/common';
import { IUserRepository } from 'src/account/user.repository';
import { UserResponseDto } from 'src/account/dtos/user-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { UpdateUserDto } from 'src/account/dtos/update-user.dto';
import { IPasswordHashingService } from 'src/security/interfaces/password-hashing.service.interface';
import { USER_MESSAGES } from 'src/account/user.messages';

@Injectable()
export class UpdateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashingService: IPasswordHashingService,
  ) {}

  async execute(
    id: string,
    dto: UpdateUserDto,
    _currentUser: AuthenticatedUserPayload,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findUserById(id);

    if (!user) {
      throw new NotFoundException(USER_MESSAGES.notFound(id));
    }

    const data: { id: string; email?: string; password?: string } = { id };

    if (dto.email) {
      data.email = dto.email;
    }

    if (dto.password) {
      data.password = await this.hashingService.hash(dto.password);
    }

    return this.userRepository.update(data);
  }
}
