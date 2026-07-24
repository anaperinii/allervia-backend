import { Injectable, NotFoundException } from '@nestjs/common';
import { IUserRepository } from '../user.repository';
import { UserResponseDto } from '../dtos/user-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { IPasswordHashingService } from 'src/security/interfaces/password-hashing.service.interface';
import { USER_MESSAGES } from '../user.messages';

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

    // User cuida apenas de credencial (email/senha). Nome, telefone e
    // especialidade pertencem ao Professional — atualizados no subsistema
    // de Professional (ver ADR 006, "perfil via Professional").
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
